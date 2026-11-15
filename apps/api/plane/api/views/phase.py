# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: public API (X-Api-Key) for the keyword map: phases, keyword-to-phase assignment and
keyword relations (Step 2). Same rules as the web app: every write goes through
``plane.utils.keyword_map``.

Permissions: phase create/edit/delete = project ADMIN (like states); phase keyword assignment and
relation writes = ADMIN or MEMBER; reads = any active project member; a GUEST only when the project has
``guest_view_all_features`` (else 403).
"""

# Third party imports
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response

# Module imports
from .base import BaseAPIView
from plane.api.serializers import ModuleRelationSerializer, PhaseModuleAssignSerializer, PhaseSerializer
from plane.app.permissions import ProjectAdminPermission, ProjectEntityPermission
from plane.db.models import ModuleRelation, Phase
from plane.utils.host import base_host
from plane.utils.keyword_map import (
    assign_modules_to_phase,
    create_module_relation,
    create_phase,
    delete_module_relation,
    delete_phase,
    get_live_project,
    get_project_phase,
    get_project_relation,
    keyword_map_errors,
    keyword_map_hidden_from_guest,
    phase_queryset,
    relation_queryset,
    remove_module_from_phase,
    update_module_relation,
    update_phase,
)
from plane.utils.openapi import (
    CURSOR_PARAMETER,
    DELETED_RESPONSE,
    FORBIDDEN_RESPONSE,
    INVALID_REQUEST_RESPONSE,
    MODULE_ID_PARAMETER,
    NOT_FOUND_RESPONSE,
    PER_PAGE_PARAMETER,
    PROJECT_ID_PARAMETER,
    UNAUTHORIZED_RESPONSE,
    WORKSPACE_SLUG_PARAMETER,
    create_paginated_response,
)


def _path_uuid(name, description):
    return OpenApiParameter(
        name=name, type=OpenApiTypes.UUID, location=OpenApiParameter.PATH, description=description, required=True
    )


GUEST_DENIED = {"error": "You don't have the required permissions."}

PHASE_PK_PARAMETER = _path_uuid("pk", "Phase ID")
PHASE_ID_PARAMETER = _path_uuid("phase_id", "Phase ID")
RELATION_PK_PARAMETER = _path_uuid("pk", "Keyword relation ID")


def keyword_map_docs(tag, **kwargs):
    parameters = [WORKSPACE_SLUG_PARAMETER, PROJECT_ID_PARAMETER] + kwargs.pop("parameters", [])
    responses = {
        401: UNAUTHORIZED_RESPONSE,
        403: FORBIDDEN_RESPONSE,
        404: NOT_FOUND_RESPONSE,
        **kwargs.pop("responses", {}),
    }
    return extend_schema(tags=[tag], parameters=parameters, responses=responses, **kwargs)


def phase_docs(**kwargs):
    return keyword_map_docs("Phases", **kwargs)


def relation_docs(**kwargs):
    return keyword_map_docs("Keyword Relations", **kwargs)


def _origin(request):
    return base_host(request=request, is_app=True)


class _PhaseAdminWriteMixin:
    """Reads: any project member. Writes: project ADMIN (``ProjectAdminPermission``), like v1 states."""

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [ProjectEntityPermission()]
        return [ProjectAdminPermission()]


class PhaseListCreateAPIEndpoint(_PhaseAdminWriteMixin, BaseAPIView):
    """List and create phases of a project."""

    model = Phase
    serializer_class = PhaseSerializer
    use_read_replica = True

    @phase_docs(
        operation_id="list_phases",
        summary="List phases",
        description="Phases of the project ordered by `sequence`, each with `module_ids` (its keywords, in order).",
        parameters=[CURSOR_PARAMETER, PER_PAGE_PARAMETER],
        responses={
            200: create_paginated_response(PhaseSerializer, "PaginatedPhaseResponse", "Paginated phases", "Phases"),
        },
    )
    def get(self, request, slug, project_id):
        get_live_project(slug, project_id)
        if keyword_map_hidden_from_guest(request.user.id, slug, project_id):
            return Response(GUEST_DENIED, status=status.HTTP_403_FORBIDDEN)
        return self.paginate(
            request=request,
            order_by="sequence",
            queryset=phase_queryset(project_id).filter(workspace__slug=slug),
            on_results=lambda phases: PhaseSerializer(phases, many=True).data,
        )

    @phase_docs(
        operation_id="create_phase",
        summary="Create phase",
        description="Project admins only. Without `sequence` the phase goes last. 400 `PHASE_NAME_TAKEN` / "
        "`INVALID_PHASE_DATES`.",
        request=PhaseSerializer,
        responses={
            201: OpenApiResponse(description="Phase created", response=PhaseSerializer),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def post(self, request, slug, project_id):
        project = get_live_project(slug, project_id)
        serializer = PhaseSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(keyword_map_errors(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
        phase = create_phase(project, serializer.validated_data, request.user, origin=_origin(request))
        return Response(
            PhaseSerializer(get_project_phase(slug, project_id, phase.id)).data, status=status.HTTP_201_CREATED
        )


class PhaseDetailAPIEndpoint(_PhaseAdminWriteMixin, BaseAPIView):
    """Get, update (incl. reorder via `sequence`) or delete a phase."""

    model = Phase
    serializer_class = PhaseSerializer

    @phase_docs(
        operation_id="retrieve_phase",
        summary="Retrieve phase",
        parameters=[PHASE_PK_PARAMETER],
        responses={200: OpenApiResponse(description="Phase", response=PhaseSerializer)},
    )
    def get(self, request, slug, project_id, pk):
        if keyword_map_hidden_from_guest(request.user.id, slug, project_id):
            return Response(GUEST_DENIED, status=status.HTTP_403_FORBIDDEN)
        return Response(PhaseSerializer(get_project_phase(slug, project_id, pk)).data, status=status.HTTP_200_OK)

    @phase_docs(
        operation_id="update_phase",
        summary="Update phase",
        description="Project admins only. Change `sequence` to reorder.",
        parameters=[PHASE_PK_PARAMETER],
        request=PhaseSerializer,
        responses={
            200: OpenApiResponse(description="Phase updated", response=PhaseSerializer),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def patch(self, request, slug, project_id, pk):
        phase = get_project_phase(slug, project_id, pk)
        serializer = PhaseSerializer(phase, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(keyword_map_errors(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
        update_phase(phase, serializer.validated_data, request.user, origin=_origin(request))
        return Response(PhaseSerializer(get_project_phase(slug, project_id, pk)).data, status=status.HTTP_200_OK)

    @phase_docs(
        operation_id="delete_phase",
        summary="Delete phase",
        description="Project admins only. Its keywords leave the phase (they are not deleted).",
        parameters=[PHASE_PK_PARAMETER],
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, project_id, pk):
        phase = get_project_phase(slug, project_id, pk)
        delete_phase(phase, request.user, origin=_origin(request))
        return Response(status=status.HTTP_204_NO_CONTENT)


class PhaseModuleAPIEndpoint(BaseAPIView):
    """Put keywords (modules) into a phase or take one out. Project ADMIN or MEMBER."""

    permission_classes = [ProjectEntityPermission]

    @phase_docs(
        operation_id="add_phase_modules",
        summary="Add keywords to phase",
        description="Keywords already in another phase move here (one phase per keyword). "
        "400 `INVALID_KEYWORD` / `KEYWORD_ARCHIVED`.",
        parameters=[PHASE_ID_PARAMETER],
        request=PhaseModuleAssignSerializer,
        responses={
            200: OpenApiResponse(description="The phase", response=PhaseSerializer),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def post(self, request, slug, project_id, phase_id):
        phase = get_project_phase(slug, project_id, phase_id)
        serializer = PhaseModuleAssignSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(keyword_map_errors(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
        assign_modules_to_phase(phase, serializer.validated_data["module_ids"], request.user)
        return Response(PhaseSerializer(get_project_phase(slug, project_id, phase_id)).data, status=status.HTTP_200_OK)

    @phase_docs(
        operation_id="remove_phase_module",
        summary="Remove keyword from phase",
        description="400 `KEYWORD_NOT_IN_PHASE` when the keyword is not in this phase.",
        parameters=[PHASE_ID_PARAMETER, MODULE_ID_PARAMETER],
        responses={204: DELETED_RESPONSE, 400: INVALID_REQUEST_RESPONSE},
    )
    def delete(self, request, slug, project_id, phase_id, module_id):
        phase = get_project_phase(slug, project_id, phase_id)
        remove_module_from_phase(phase, module_id, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ModuleRelationListCreateAPIEndpoint(BaseAPIView):
    """List and create directed keyword edges. Reads: any project member. Writes: ADMIN or MEMBER."""

    model = ModuleRelation
    serializer_class = ModuleRelationSerializer
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    @relation_docs(
        operation_id="list_module_relations",
        summary="List keyword relations",
        description="Edges whose two keywords are live and not archived, oldest first.",
        parameters=[CURSOR_PARAMETER, PER_PAGE_PARAMETER],
        responses={
            200: create_paginated_response(
                ModuleRelationSerializer,
                "PaginatedModuleRelationResponse",
                "Paginated keyword relations",
                "Keyword Relations",
            ),
        },
    )
    def get(self, request, slug, project_id):
        get_live_project(slug, project_id)
        if keyword_map_hidden_from_guest(request.user.id, slug, project_id):
            return Response(GUEST_DENIED, status=status.HTTP_403_FORBIDDEN)
        return self.paginate(
            request=request,
            order_by="created_at",
            queryset=relation_queryset(project_id).filter(workspace__slug=slug),
            on_results=lambda relations: ModuleRelationSerializer(relations, many=True).data,
        )

    @relation_docs(
        operation_id="create_module_relation",
        summary="Create keyword relation",
        description="`source_module` -> `target_module`, same project. 400 `SELF_RELATION`, "
        "`DUPLICATE_RELATION`, `INVALID_KEYWORD`, `KEYWORD_ARCHIVED`.",
        request=ModuleRelationSerializer,
        responses={
            201: OpenApiResponse(description="Relation created", response=ModuleRelationSerializer),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def post(self, request, slug, project_id):
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
            origin=_origin(request),
        )
        return Response(ModuleRelationSerializer(relation).data, status=status.HTTP_201_CREATED)


class ModuleRelationDetailAPIEndpoint(BaseAPIView):
    """Update or delete a keyword edge. ADMIN or MEMBER."""

    model = ModuleRelation
    serializer_class = ModuleRelationSerializer
    permission_classes = [ProjectEntityPermission]

    @relation_docs(
        operation_id="update_module_relation",
        summary="Update keyword relation",
        parameters=[RELATION_PK_PARAMETER],
        request=ModuleRelationSerializer,
        responses={
            200: OpenApiResponse(description="Relation updated", response=ModuleRelationSerializer),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def patch(self, request, slug, project_id, pk):
        relation = get_project_relation(slug, project_id, pk)
        serializer = ModuleRelationSerializer(relation, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(keyword_map_errors(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
        relation = update_module_relation(relation, serializer.validated_data, request.user, origin=_origin(request))
        return Response(ModuleRelationSerializer(relation).data, status=status.HTTP_200_OK)

    @relation_docs(
        operation_id="delete_module_relation",
        summary="Delete keyword relation",
        parameters=[RELATION_PK_PARAMETER],
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, project_id, pk):
        relation = get_project_relation(slug, project_id, pk)
        delete_module_relation(relation, request.user, origin=_origin(request))
        return Response(status=status.HTTP_204_NO_CONTENT)
