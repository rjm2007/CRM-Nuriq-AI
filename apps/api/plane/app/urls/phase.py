# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: keyword map routes (phases, keyword-to-phase assignment, keyword relations). Step 2."""

from django.urls import path

from plane.app.views import ModuleRelationViewSet, PhaseModuleEndpoint, PhaseViewSet

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/",
        PhaseViewSet.as_view({"get": "list", "post": "create"}),
        name="project-phases",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/<uuid:pk>/",
        PhaseViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="project-phase-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/<uuid:phase_id>/modules/",
        PhaseModuleEndpoint.as_view(http_method_names=["post"]),
        name="project-phase-modules",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/<uuid:phase_id>/modules/<uuid:module_id>/",
        PhaseModuleEndpoint.as_view(http_method_names=["delete"]),
        name="project-phase-module-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/module-relations/",
        ModuleRelationViewSet.as_view({"get": "list", "post": "create"}),
        name="project-module-relations",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/module-relations/<uuid:pk>/",
        ModuleRelationViewSet.as_view({"patch": "partial_update", "delete": "destroy"}),
        name="project-module-relation-detail",
    ),
]
