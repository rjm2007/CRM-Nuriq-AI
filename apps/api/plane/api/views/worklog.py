# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: public API (X-Api-Key) for time entries (IssueWorkLog). Same rules as the web app,
see plane/utils/worklog.py and plane/app/views/issue/worklog.py."""

# Python imports
import json

# Django imports
from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone

# Third party imports
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .base import BaseAPIView
from plane.api.serializers import IssueWorkLogSerializer, WorkLogSummarySerializer
from plane.app.permissions import ProjectEntityPermission
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import Issue, IssueWorkLog
from plane.utils.openapi import (
    CURSOR_PARAMETER,
    FORBIDDEN_RESPONSE,
    INVALID_REQUEST_RESPONSE,
    ISSUE_ID_PARAMETER,
    ISSUE_NOT_FOUND_RESPONSE,
    NOT_FOUND_RESPONSE,
    PER_PAGE_PARAMETER,
    PROJECT_ID_PARAMETER,
    UNAUTHORIZED_RESPONSE,
    WORKSPACE_SLUG_PARAMETER,
    create_paginated_response,
)
from plane.utils.worklog import (
    apply_worklog_filters,
    can_access_time_tracking,
    can_manage_worklog,
    ensure_time_tracking_enabled,
    is_project_admin,
    project_worklog_queryset,
    worklog_errors,
    worklog_summary,
)

WORKLOG_ID_PARAMETER = OpenApiParameter(
    name="pk", type=OpenApiTypes.UUID, location=OpenApiParameter.PATH, description="Time entry ID", required=True
)

WORKLOG_FILTER_PARAMETERS = [
    OpenApiParameter(name="user", type=OpenApiTypes.STR, description="Comma-separated user IDs"),
    OpenApiParameter(name="issue", type=OpenApiTypes.UUID, description="Only entries on this work item"),
    OpenApiParameter(
        name="include_subtasks",
        type=OpenApiTypes.BOOL,
        description="With `issue`: also entries on its direct, non-deleted subtasks",
    ),
    OpenApiParameter(name="started_at__gte", type=OpenApiTypes.STR, description="ISO date/datetime (naive = UTC)"),
    OpenApiParameter(name="started_at__lt", type=OpenApiTypes.STR, description="ISO date/datetime (naive = UTC)"),
]

NO_ACCESS = {"error": "Only project admins and members can use time tracking."}


def worklog_docs(**kwargs):
    defaults = {
        "tags": ["Work Item Time Entries"],
        "parameters": [WORKSPACE_SLUG_PARAMETER, PROJECT_ID_PARAMETER],
        "responses": {401: UNAUTHORIZED_RESPONSE, 403: FORBIDDEN_RESPONSE, 404: NOT_FOUND_RESPONSE},
    }
    parameters = defaults["parameters"] + kwargs.pop("parameters", [])
    responses = {**defaults["responses"], **kwargs.pop("responses", {})}
    return extend_schema(tags=defaults["tags"], parameters=parameters, responses=responses, **kwargs)


def _dump(data):
    return json.dumps(data, cls=DjangoJSONEncoder)


class _WorkLogBase(BaseAPIView):
    model = IssueWorkLog
    serializer_class = IssueWorkLogSerializer
    permission_classes = [ProjectEntityPermission]

    def _deny(self, request, slug, project_id):
        if can_access_time_tracking(request.user.id, slug, project_id):
            return None
        return Response(NO_ACCESS, status=status.HTTP_403_FORBIDDEN)

    def _get_issue(self, slug, project_id, issue_id):
        return Issue.issue_objects.select_related("project").get(
            pk=issue_id, workspace__slug=slug, project_id=project_id
        )

    def _entries(self, slug, project_id, issue_id):
        return (
            IssueWorkLog.objects.filter(workspace__slug=slug, project_id=project_id, issue_id=issue_id)
            .filter(project__archived_at__isnull=True)
            .select_related("user")
        )

    def _context(self, request, project_id):
        return {
            "actor": request.user,
            "project_id": project_id,
            "is_admin": is_project_admin(request.user.id, project_id),
        }

    def _log_activity(self, request, kind, issue_id, project_id, requested_data, current_instance):
        issue_activity.delay(
            type=f"worklog.activity.{kind}",
            requested_data=requested_data,
            actor_id=str(request.user.id),
            issue_id=str(issue_id),
            project_id=str(project_id),
            current_instance=current_instance,
            epoch=int(timezone.now().timestamp()),
            notification=False,
        )


class IssueWorkLogListCreateAPIEndpoint(_WorkLogBase):
    """List and create time entries on a work item."""

    use_read_replica = True

    @worklog_docs(
        operation_id="list_work_item_time_entries",
        summary="List work item time entries",
        description="Time entries on a work item, newest first. Allowed even when time tracking is off.",
        parameters=[ISSUE_ID_PARAMETER, CURSOR_PARAMETER, PER_PAGE_PARAMETER],
        responses={
            200: create_paginated_response(
                IssueWorkLogSerializer,
                "PaginatedIssueWorkLogResponse",
                "Paginated list of time entries",
                "Paginated Time Entries",
            ),
            404: ISSUE_NOT_FOUND_RESPONSE,
        },
    )
    def get(self, request, slug, project_id, issue_id):
        denied = self._deny(request, slug, project_id)
        if denied:
            return denied
        self._get_issue(slug, project_id, issue_id)
        return self.paginate(
            request=request,
            order_by="-started_at",
            queryset=self._entries(slug, project_id, issue_id),
            on_results=lambda worklogs: IssueWorkLogSerializer(worklogs, many=True).data,
        )

    @worklog_docs(
        operation_id="create_work_item_time_entry",
        summary="Log time on a work item",
        description=(
            "Create a time entry. 403 `TIME_TRACKING_DISABLED` when the project flag is off. "
            "Only project admins may set `user` to someone else (400 `INVALID_WORKLOG_USER`)."
        ),
        parameters=[ISSUE_ID_PARAMETER],
        request=IssueWorkLogSerializer,
        responses={
            201: OpenApiResponse(description="Time entry created", response=IssueWorkLogSerializer),
            400: INVALID_REQUEST_RESPONSE,
            404: ISSUE_NOT_FOUND_RESPONSE,
        },
    )
    def post(self, request, slug, project_id, issue_id):
        denied = self._deny(request, slug, project_id)
        if denied:
            return denied
        issue = self._get_issue(slug, project_id, issue_id)
        ensure_time_tracking_enabled(issue.project)

        serializer = IssueWorkLogSerializer(data=request.data, context=self._context(request, project_id))
        if not serializer.is_valid():
            return Response(worklog_errors(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
        user_id = serializer.validated_data.pop("user_id", None) or request.user.id
        serializer.save(project_id=project_id, issue_id=issue_id, user_id=user_id)

        data = IssueWorkLogSerializer(self._entries(slug, project_id, issue_id).get(pk=serializer.instance.id)).data
        self._log_activity(request, "created", issue_id, project_id, _dump(data), None)
        return Response(data, status=status.HTTP_201_CREATED)


class IssueWorkLogDetailAPIEndpoint(_WorkLogBase):
    """Update or delete one time entry (own entries, or any entry for project admins)."""

    def _load(self, request, slug, project_id, issue_id, pk):
        issue = self._get_issue(slug, project_id, issue_id)
        worklog = self._entries(slug, project_id, issue_id).get(pk=pk)
        ensure_time_tracking_enabled(issue.project)
        return worklog

    @worklog_docs(
        operation_id="update_work_item_time_entry",
        summary="Update a time entry",
        description="Members may update their own entries; project admins any entry. `issue` cannot change.",
        parameters=[ISSUE_ID_PARAMETER, WORKLOG_ID_PARAMETER],
        request=IssueWorkLogSerializer,
        responses={
            200: OpenApiResponse(description="Time entry updated", response=IssueWorkLogSerializer),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def patch(self, request, slug, project_id, issue_id, pk):
        denied = self._deny(request, slug, project_id)
        if denied:
            return denied
        worklog = self._load(request, slug, project_id, issue_id, pk)
        context = self._context(request, project_id)
        if not can_manage_worklog(request.user, worklog, context["is_admin"]):
            return Response({"error": "You can only change your own time entries."}, status=status.HTTP_403_FORBIDDEN)

        current_instance = _dump(IssueWorkLogSerializer(worklog).data)
        serializer = IssueWorkLogSerializer(worklog, data=request.data, partial=True, context=context)
        if not serializer.is_valid():
            return Response(worklog_errors(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
        serializer.save()

        data = IssueWorkLogSerializer(self._entries(slug, project_id, issue_id).get(pk=pk)).data
        self._log_activity(request, "updated", issue_id, project_id, _dump(data), current_instance)
        return Response(data, status=status.HTTP_200_OK)

    @worklog_docs(
        operation_id="delete_work_item_time_entry",
        summary="Delete a time entry",
        description="Members may delete their own entries; project admins any entry.",
        parameters=[ISSUE_ID_PARAMETER, WORKLOG_ID_PARAMETER],
        responses={204: OpenApiResponse(description="Time entry deleted")},
    )
    def delete(self, request, slug, project_id, issue_id, pk):
        denied = self._deny(request, slug, project_id)
        if denied:
            return denied
        worklog = self._load(request, slug, project_id, issue_id, pk)
        if not can_manage_worklog(request.user, worklog, is_project_admin(request.user.id, project_id)):
            return Response({"error": "You can only delete your own time entries."}, status=status.HTTP_403_FORBIDDEN)

        current_instance = _dump(IssueWorkLogSerializer(worklog).data)
        worklog.delete()
        self._log_activity(request, "deleted", issue_id, project_id, _dump({"worklog_id": str(pk)}), current_instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectWorkLogAPIEndpoint(_WorkLogBase):
    """All time entries of a project, filtered and paginated."""

    use_read_replica = True

    @worklog_docs(
        operation_id="list_project_time_entries",
        summary="List project time entries",
        description="Time entries of a project, newest first. 400 `INVALID_WORKLOG_FILTER` on bad filters.",
        parameters=[*WORKLOG_FILTER_PARAMETERS, CURSOR_PARAMETER, PER_PAGE_PARAMETER],
        responses={
            200: create_paginated_response(
                IssueWorkLogSerializer,
                "PaginatedProjectWorkLogResponse",
                "Paginated list of project time entries",
                "Paginated Project Time Entries",
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def get(self, request, slug, project_id):
        denied = self._deny(request, slug, project_id)
        if denied:
            return denied
        queryset = apply_worklog_filters(project_worklog_queryset(slug, project_id), request.GET).select_related("user")
        return self.paginate(
            request=request,
            order_by="-started_at",
            queryset=queryset,
            on_results=lambda worklogs: IssueWorkLogSerializer(worklogs, many=True).data,
        )


class ProjectWorkLogSummaryAPIEndpoint(_WorkLogBase):
    """Total minutes and minutes per user, with the project list filters."""

    use_read_replica = True

    @worklog_docs(
        operation_id="summarize_project_time_entries",
        summary="Summarize project time entries",
        description="`{total_minutes, by_user: [{user_id, minutes}]}` for the filtered entries.",
        parameters=WORKLOG_FILTER_PARAMETERS,
        responses={
            200: OpenApiResponse(description="Time summary", response=WorkLogSummarySerializer),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def get(self, request, slug, project_id):
        denied = self._deny(request, slug, project_id)
        if denied:
            return denied
        queryset = apply_worklog_filters(project_worklog_queryset(slug, project_id), request.GET)
        return Response(worklog_summary(queryset), status=status.HTTP_200_OK)
