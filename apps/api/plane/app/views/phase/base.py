# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: web-app views for project phases and keyword-to-phase assignment (Step 2).

Thin: input is checked by ``plane.app.serializers.phase`` and every write goes through
``plane.utils.keyword_map`` (rules, webhooks, ``phase`` activity fan-out).
"""

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .. import BaseAPIView, BaseViewSet
from plane.app.permissions import ROLE, ProjectEntityPermission, allow_permission
from plane.app.serializers import PhaseModuleAssignSerializer, PhaseSerializer
from plane.db.models import Phase
from plane.utils.host import base_host
from plane.utils.keyword_map import (
    assign_modules_to_phase,
    create_phase,
    delete_phase,
    get_live_project,
    get_project_phase,
    keyword_map_errors,
    keyword_map_hidden_from_guest,
    phase_queryset,
    remove_module_from_phase,
    update_phase,
)

GUEST_DENIED = {"error": "You don't have the required permissions."}


class PhaseViewSet(BaseViewSet):
    """Phases of a project, ordered by ``sequence``. Reorder = PATCH ``sequence``.

    Reads: project ADMIN, MEMBER, and GUEST only when the project has ``guest_view_all_features``.
    Create/edit/delete/reorder: project ADMIN (like States).
    """

    model = Phase
    serializer_class = PhaseSerializer
    permission_classes = [ProjectEntityPermission]

    def get_queryset(self):
        return phase_queryset(self.kwargs.get("project_id")).filter(
            workspace__slug=self.kwargs.get("slug"), project__archived_at__isnull=True
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def list(self, request, slug, project_id):
        if keyword_map_hidden_from_guest(request.user.id, slug, project_id):
            return Response(GUEST_DENIED, status=status.HTTP_403_FORBIDDEN)
        return Response(PhaseSerializer(self.get_queryset(), many=True).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def retrieve(self, request, slug, project_id, pk):
        if keyword_map_hidden_from_guest(request.user.id, slug, project_id):
            return Response(GUEST_DENIED, status=status.HTTP_403_FORBIDDEN)
        return Response(PhaseSerializer(get_project_phase(slug, project_id, pk)).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def create(self, request, slug, project_id):
        project = get_live_project(slug, project_id)
        serializer = PhaseSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(keyword_map_errors(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
        phase = create_phase(
            project, serializer.validated_data, request.user, origin=base_host(request=request, is_app=True)
        )
        return Response(
            PhaseSerializer(get_project_phase(slug, project_id, phase.id)).data, status=status.HTTP_201_CREATED
        )

    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, slug, project_id, pk):
        phase = get_project_phase(slug, project_id, pk)
        serializer = PhaseSerializer(phase, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(keyword_map_errors(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
        update_phase(phase, serializer.validated_data, request.user, origin=base_host(request=request, is_app=True))
        return Response(PhaseSerializer(get_project_phase(slug, project_id, pk)).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, slug, project_id, pk):
        phase = get_project_phase(slug, project_id, pk)
        delete_phase(phase, request.user, origin=base_host(request=request, is_app=True))
        return Response(status=status.HTTP_204_NO_CONTENT)


class PhaseModuleEndpoint(BaseAPIView):
    """Put keywords into a phase (each moves out of its old phase) or take one out.

    Project ADMIN and MEMBER. POST returns the phase (``module_ids`` updated).
    """

    permission_classes = [ProjectEntityPermission]

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id, phase_id):
        phase = get_project_phase(slug, project_id, phase_id)
        serializer = PhaseModuleAssignSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(keyword_map_errors(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
        assign_modules_to_phase(phase, serializer.validated_data["module_ids"], request.user)
        return Response(PhaseSerializer(get_project_phase(slug, project_id, phase_id)).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def delete(self, request, slug, project_id, phase_id, module_id):
        phase = get_project_phase(slug, project_id, phase_id)
        remove_module_from_phase(phase, module_id, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
