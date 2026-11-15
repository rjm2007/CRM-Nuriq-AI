# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: time entries (IssueWorkLog) for the web app. Rules live in plane/utils/worklog.py."""

# Python imports
import json

# Django imports
from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone

# Third Party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .. import BaseAPIView, BaseViewSet
from plane.app.permissions import ROLE, ProjectEntityPermission, allow_permission
from plane.app.serializers import IssueWorkLogSerializer
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import Issue, IssueWorkLog
from plane.utils.host import base_host
from plane.utils.worklog import (
    WORKLOG_ISSUE_LIST_CAP,
    apply_worklog_filters,
    can_manage_worklog,
    ensure_time_tracking_enabled,
    is_project_admin,
    project_worklog_queryset,
    require_time_access,
    worklog_errors,
    worklog_summary,
)


def _dump(data):
    return json.dumps(data, cls=DjangoJSONEncoder)


class IssueWorkLogViewSet(BaseViewSet):
    """List/create time entries on one issue; edit/delete one entry.

    Project ADMIN/MEMBER only (guests get 403, even on reads; so does a workspace admin whose project
    role is GUEST). The issue list returns at most ``WORKLOG_ISSUE_LIST_CAP`` (1000) newest entries. Writes need
    ``Project.is_time_tracking_enabled`` (403 ``TIME_TRACKING_DISABLED``); reads don't.
    """

    permission_classes = [ProjectEntityPermission]
    model = IssueWorkLog
    serializer_class = IssueWorkLogSerializer

    def get_queryset(self):
        return (
            IssueWorkLog.objects.filter(
                workspace__slug=self.kwargs.get("slug"),
                project_id=self.kwargs.get("project_id"),
                issue_id=self.kwargs.get("issue_id"),
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .select_related("user", "created_by")
            .order_by("-started_at", "-created_at", "-id")
            .distinct()
        )

    def _get_issue(self, slug, project_id, issue_id):
        # The URL issue must be a live issue of the URL workspace + project (404 otherwise).
        return Issue.issue_objects.select_related("project").get(
            pk=issue_id, workspace__slug=slug, project_id=project_id
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
            origin=base_host(request=request, is_app=True),
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    @require_time_access
    def list(self, request, slug, project_id, issue_id):
        self._get_issue(slug, project_id, issue_id)
        serializer = IssueWorkLogSerializer(self.get_queryset()[:WORKLOG_ISSUE_LIST_CAP], many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    @require_time_access
    def create(self, request, slug, project_id, issue_id):
        issue = self._get_issue(slug, project_id, issue_id)
        ensure_time_tracking_enabled(issue.project)

        serializer = IssueWorkLogSerializer(data=request.data, context=self._context(request, project_id))
        if not serializer.is_valid():
            return Response(worklog_errors(serializer.errors), status=status.HTTP_400_BAD_REQUEST)

        user_id = serializer.validated_data.pop("user_id", None) or request.user.id
        serializer.save(project_id=project_id, issue_id=issue_id, user_id=user_id)
        worklog = self.get_queryset().get(pk=serializer.instance.id)
        data = IssueWorkLogSerializer(worklog).data
        self._log_activity(request, "created", issue_id, project_id, _dump(data), None)
        return Response(data, status=status.HTTP_201_CREATED)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    @require_time_access
    def partial_update(self, request, slug, project_id, issue_id, pk):
        issue = self._get_issue(slug, project_id, issue_id)
        worklog = self.get_queryset().get(pk=pk)
        ensure_time_tracking_enabled(issue.project)

        context = self._context(request, project_id)
        if not can_manage_worklog(request.user, worklog, context["is_admin"]):
            return Response(
                {"error": "You can only change your own time entries."},
                status=status.HTTP_403_FORBIDDEN,
            )

        current_instance = _dump(IssueWorkLogSerializer(worklog).data)
        serializer = IssueWorkLogSerializer(worklog, data=request.data, partial=True, context=context)
        if not serializer.is_valid():
            return Response(worklog_errors(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
        serializer.save()

        data = IssueWorkLogSerializer(self.get_queryset().get(pk=pk)).data
        self._log_activity(request, "updated", issue_id, project_id, _dump(data), current_instance)
        return Response(data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    @require_time_access
    def destroy(self, request, slug, project_id, issue_id, pk):
        issue = self._get_issue(slug, project_id, issue_id)
        worklog = self.get_queryset().get(pk=pk)
        ensure_time_tracking_enabled(issue.project)

        if not can_manage_worklog(request.user, worklog, is_project_admin(request.user.id, project_id)):
            return Response(
                {"error": "You can only delete your own time entries."},
                status=status.HTTP_403_FORBIDDEN,
            )

        current_instance = _dump(IssueWorkLogSerializer(worklog).data)
        worklog.delete()
        self._log_activity(request, "deleted", issue_id, project_id, _dump({"worklog_id": str(pk)}), current_instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectWorkLogEndpoint(BaseAPIView):
    """Paginated time entries of a project, newest first.

    Filters: ``user`` (comma ids), ``issue``, ``include_subtasks``, ``started_at__gte``, ``started_at__lt``.
    """

    permission_classes = [ProjectEntityPermission]

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    @require_time_access
    def get(self, request, slug, project_id):
        queryset = apply_worklog_filters(project_worklog_queryset(slug, project_id), request.GET).select_related(
            "user", "created_by"
        )
        return self.paginate(
            request=request,
            order_by="-started_at",
            queryset=queryset,
            on_results=lambda worklogs: IssueWorkLogSerializer(worklogs, many=True).data,
        )


class ProjectWorkLogSummaryEndpoint(BaseAPIView):
    """``{"total_minutes", "by_user": [{"user_id", "minutes"}]}`` with the project list filters."""

    permission_classes = [ProjectEntityPermission]

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    @require_time_access
    def get(self, request, slug, project_id):
        queryset = apply_worklog_filters(project_worklog_queryset(slug, project_id), request.GET)
        return Response(worklog_summary(queryset), status=status.HTTP_200_OK)
