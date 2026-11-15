# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: manual time entries on work items (time tracking v1)."""

# Django imports
from django.conf import settings
from django.db import models
from django.db.models import Q

# Module imports
from .project import ProjectBaseModel

WORKLOG_MIN_MINUTES = 1
WORKLOG_MAX_MINUTES = 1440


class IssueWorkLog(ProjectBaseModel):
    """One block of time a project member spent on an issue.

    `user` is whose time it is; `created_by` (from BaseModel) is who logged it
    (a project admin may log on behalf of another member). Soft delete comes from
    BaseModel, and deleting an issue soft-deletes its entries via the CASCADE FK.
    """

    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="issue_worklogs")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="issue_worklogs")
    started_at = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField()
    note = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Issue Work Log"
        verbose_name_plural = "Issue Work Logs"
        db_table = "issue_worklogs"
        ordering = ("-started_at",)
        indexes = [
            models.Index(fields=["project", "started_at"], name="worklog_project_started_idx"),
            models.Index(fields=["user", "started_at"], name="worklog_user_started_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(duration_minutes__gte=WORKLOG_MIN_MINUTES) & Q(duration_minutes__lte=WORKLOG_MAX_MINUTES),
                name="issue_worklog_duration_range",
            )
        ]

    def __str__(self):
        return f"{self.issue_id} {self.user_id} {self.duration_minutes}m"
