# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: public-API routes for time entries, under issues/ and work-items/ like links."""

from django.urls import path

from plane.api.views.worklog import (
    IssueWorkLogDetailAPIEndpoint,
    IssueWorkLogListCreateAPIEndpoint,
    ProjectWorkLogAPIEndpoint,
    ProjectWorkLogSummaryAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/worklogs/",
        IssueWorkLogListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="worklog",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/worklogs/<uuid:pk>/",
        IssueWorkLogDetailAPIEndpoint.as_view(http_method_names=["patch", "delete"]),
        name="worklog",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/worklogs/",
        IssueWorkLogListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-worklog-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/worklogs/<uuid:pk>/",
        IssueWorkLogDetailAPIEndpoint.as_view(http_method_names=["patch", "delete"]),
        name="work-item-worklog-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/worklogs/",
        ProjectWorkLogAPIEndpoint.as_view(http_method_names=["get"]),
        name="project-worklog-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/worklogs/summary/",
        ProjectWorkLogSummaryAPIEndpoint.as_view(http_method_names=["get"]),
        name="project-worklog-summary",
    ),
]
