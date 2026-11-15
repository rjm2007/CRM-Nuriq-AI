# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: public-API routes for the keyword map (phases, phase keywords, keyword relations). Step 2."""

from django.urls import path

from plane.api.views.phase import (
    ModuleRelationDetailAPIEndpoint,
    ModuleRelationListCreateAPIEndpoint,
    PhaseDetailAPIEndpoint,
    PhaseListCreateAPIEndpoint,
    PhaseModuleAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/",
        PhaseListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="phase-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/<uuid:pk>/",
        PhaseDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="phase-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/<uuid:phase_id>/modules/",
        PhaseModuleAPIEndpoint.as_view(http_method_names=["post"]),
        name="phase-modules",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/<uuid:phase_id>/modules/<uuid:module_id>/",
        PhaseModuleAPIEndpoint.as_view(http_method_names=["delete"]),
        name="phase-module-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/module-relations/",
        ModuleRelationListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="module-relation-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/module-relations/<uuid:pk>/",
        ModuleRelationDetailAPIEndpoint.as_view(http_method_names=["patch", "delete"]),
        name="module-relation-detail",
    ),
]
