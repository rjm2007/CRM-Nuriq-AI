# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: public-API serializer for time entries (IssueWorkLog). Rules live in plane/utils/worklog.py."""

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from .user import UserLiteSerializer
from plane.db.models import IssueWorkLog
from plane.db.models.worklog import WORKLOG_MAX_MINUTES, WORKLOG_MIN_MINUTES
from plane.utils.worklog import WORKLOG_MAX_NOTE_LENGTH, validate_started_at, validate_worklog_attrs


class IssueWorkLogSerializer(BaseSerializer):
    """
    Time entry on a work item.

    ``user`` defaults to the API key's user; only project admins may set it to another active
    project admin/member. ``issue`` comes from the URL and cannot change.
    Context: ``actor``, ``project_id``, ``is_admin``.
    """

    issue = serializers.UUIDField(source="issue_id", read_only=True)
    project = serializers.UUIDField(source="project_id", read_only=True)
    workspace = serializers.UUIDField(source="workspace_id", read_only=True)
    user = serializers.UUIDField(source="user_id", required=False, help_text="Whose time this is (defaults to you)")
    started_at = serializers.DateTimeField(
        validators=[validate_started_at], help_text="Not before 2000-01-01; at most 24h in the future"
    )
    duration_minutes = serializers.IntegerField(min_value=WORKLOG_MIN_MINUTES, max_value=WORKLOG_MAX_MINUTES)
    note = serializers.CharField(
        max_length=WORKLOG_MAX_NOTE_LENGTH, allow_blank=True, required=False, trim_whitespace=True
    )
    user_detail = UserLiteSerializer(read_only=True, source="user")

    class Meta:
        model = IssueWorkLog
        fields = [
            "id",
            "issue",
            "project",
            "workspace",
            "user",
            "user_detail",
            "started_at",
            "duration_minutes",
            "note",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "updated_by", "created_at", "updated_at"]

    def validate(self, attrs):
        return validate_worklog_attrs(self, attrs)


class WorkLogSummaryUserSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    minutes = serializers.IntegerField()


class WorkLogSummarySerializer(serializers.Serializer):
    """Totals for the filtered time entries of a project."""

    total_minutes = serializers.IntegerField()
    by_user = WorkLogSummaryUserSerializer(many=True)
