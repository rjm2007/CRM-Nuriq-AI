# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: web-app serializer for time entries (IssueWorkLog)."""

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from .user import UserLiteSerializer
from plane.db.models import IssueWorkLog
from plane.db.models.worklog import WORKLOG_MAX_MINUTES, WORKLOG_MIN_MINUTES
from plane.utils.worklog import WORKLOG_MAX_NOTE_LENGTH, validate_started_at, validate_worklog_attrs


class IssueWorkLogSerializer(BaseSerializer):
    """Create/update/read a time entry.

    Context: ``actor`` (request user), ``project_id``, ``is_admin`` (project admin).
    ``user`` defaults to the actor in the view; ``issue`` comes from the URL and never changes.
    """

    issue = serializers.UUIDField(source="issue_id", read_only=True)
    project = serializers.UUIDField(source="project_id", read_only=True)
    workspace = serializers.UUIDField(source="workspace_id", read_only=True)
    user = serializers.UUIDField(source="user_id", required=False)
    started_at = serializers.DateTimeField(validators=[validate_started_at])
    duration_minutes = serializers.IntegerField(min_value=WORKLOG_MIN_MINUTES, max_value=WORKLOG_MAX_MINUTES)
    note = serializers.CharField(
        max_length=WORKLOG_MAX_NOTE_LENGTH, allow_blank=True, required=False, trim_whitespace=True
    )
    user_detail = UserLiteSerializer(read_only=True, source="user")
    created_by_detail = UserLiteSerializer(read_only=True, source="created_by")

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
            "created_by_detail",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "updated_by", "created_at", "updated_at"]

    def validate(self, attrs):
        return validate_worklog_attrs(self, attrs)
