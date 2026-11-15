# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: web-app views for keyword-map edges (ModuleRelation, Step 2). Writes go through
``plane.utils.keyword_map``."""

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .. import BaseViewSet
from plane.app.permissions import ROLE, ProjectEntityPermission, allow_permission
from plane.app.serializers import ModuleRelationSerializer
from plane.db.models import ModuleRelation
from plane.utils.host import base_host
from plane.utils.keyword_map import (
    create_module_relation,
    delete_module_relation,
    get_live_project,
    get_project_relation,
    keyword_map_errors,
    keyword_map_hidden_from_guest,
    relation_queryset,
    update_module_relation,
)

GUEST_DENIED = {"error": "You don't have the required permissions."}


class ModuleRelationViewSet(BaseViewSet):
    """Directed edges between keywords of a project. Reads: ADMIN, MEMBER, GUEST (only with
    ``guest_view_all_features``). Writes: ADMIN, MEMBER.

    The list leaves out edges whose ends are archived or deleted.
    """

    model = ModuleRelation
    serializer_class = ModuleRelationSerializer
    permission_classes = [ProjectEntityPermission]

    def get_queryset(self):
        return relation_queryset(self.kwargs.get("project_id")).filter(
            workspace__slug=self.kwargs.get("slug"), project__archived_at__isnull=True
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def list(self, request, slug, project_id):
        if keyword_map_hidden_from_guest(request.user.id, slug, project_id):
            return Response(GUEST_DENIED, status=status.HTTP_403_FORBIDDEN)
        return Response(ModuleRelationSerializer(self.get_queryset(), many=True).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def create(self, request, slug, project_id):
        project = get_live_project(slug, project_id)
        serializer = ModuleRelationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(keyword_map_errors(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        relation = create_module_relation(
            project,
            data["source_module_id"],
            data["target_module_id"],
            request.user,
            label=data.get("label", ""),
            origin=base_host(request=request, is_app=True),
        )
        return Response(ModuleRelationSerializer(relation).data, status=status.HTTP_201_CREATED)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def partial_update(self, request, slug, project_id, pk):
        relation = get_project_relation(slug, project_id, pk)
        serializer = ModuleRelationSerializer(relation, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(keyword_map_errors(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
        relation = update_module_relation(
            relation, serializer.validated_data, request.user, origin=base_host(request=request, is_app=True)
        )
        return Response(ModuleRelationSerializer(relation).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def destroy(self, request, slug, project_id, pk):
        relation = get_project_relation(slug, project_id, pk)
        delete_module_relation(relation, request.user, origin=base_host(request=request, is_app=True))
        return Response(status=status.HTTP_204_NO_CONTENT)
