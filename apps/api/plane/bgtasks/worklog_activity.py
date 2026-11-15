# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: Activity-tab rows for time entries (IssueWorkLog).

Registered in ``issue_activities_task.issue_activity`` as ``worklog.activity.created|updated|deleted``.
Same signature as ``create_link_activity``. ``requested_data`` / ``current_instance`` are JSON dumps of
``IssueWorkLogSerializer`` (``current_instance`` = before, ``requested_data`` = after the save).
Rows: ``field="worklog"``, values = minutes as a string, ``new_identifier`` / ``old_identifier`` = entry id.
"""

# Python imports
import json

# Module imports
from plane.db.models import IssueActivity

# Fields whose change makes an update worth a row
TRACKED_FIELDS = ("duration_minutes", "started_at", "note", "user")


def _load(value):
    return json.loads(value) if value is not None else None


def _minutes(data):
    if not data or data.get("duration_minutes") is None:
        return ""
    return str(data.get("duration_minutes"))


def _for_whom(data, actor_id):
    """`` for <name>`` when the entry belongs to someone other than the actor."""
    if not data or not data.get("user") or str(data.get("user")) == str(actor_id):
        return ""
    detail = data.get("user_detail") or {}
    name = detail.get("display_name") or detail.get("first_name") or "another member"
    return f" for {name}"


def create_worklog_activity(
    requested_data,
    current_instance,
    issue_id,
    project_id,
    actor_id,
    workspace_id,
    issue_activities,
    epoch,
):
    requested_data = _load(requested_data)
    if not requested_data:
        return
    minutes = _minutes(requested_data)
    issue_activities.append(
        IssueActivity(
            issue_id=issue_id,
            project_id=project_id,
            workspace_id=workspace_id,
            comment=f"logged {minutes} minutes{_for_whom(requested_data, actor_id)}",
            verb="created",
            actor_id=actor_id,
            field="worklog",
            new_value=minutes,
            new_identifier=requested_data.get("id"),
            epoch=epoch,
        )
    )


def update_worklog_activity(
    requested_data,
    current_instance,
    issue_id,
    project_id,
    workspace_id,
    actor_id,
    issue_activities,
    epoch,
):
    requested_data = _load(requested_data)
    current_instance = _load(current_instance)
    if not requested_data or not current_instance:
        return
    if all(str(requested_data.get(key)) == str(current_instance.get(key)) for key in TRACKED_FIELDS):
        return  # no-op update: no row

    old_minutes = _minutes(current_instance)
    new_minutes = _minutes(requested_data)
    if old_minutes != new_minutes:
        comment = f"updated logged time from {old_minutes} to {new_minutes} minutes"
    else:
        comment = f"updated a time entry of {new_minutes} minutes"
    issue_activities.append(
        IssueActivity(
            issue_id=issue_id,
            project_id=project_id,
            workspace_id=workspace_id,
            comment=comment,
            verb="updated",
            actor_id=actor_id,
            field="worklog",
            old_value=old_minutes,
            new_value=new_minutes,
            old_identifier=current_instance.get("id"),
            new_identifier=requested_data.get("id"),
            epoch=epoch,
        )
    )


def delete_worklog_activity(
    requested_data,
    current_instance,
    issue_id,
    project_id,
    workspace_id,
    actor_id,
    issue_activities,
    epoch,
):
    current_instance = _load(current_instance)
    if not current_instance:
        return
    minutes = _minutes(current_instance)
    issue_activities.append(
        IssueActivity(
            issue_id=issue_id,
            project_id=project_id,
            workspace_id=workspace_id,
            comment=f"deleted a time entry of {minutes} minutes",
            verb="deleted",
            actor_id=actor_id,
            field="worklog",
            old_value=minutes,
            new_value="",
            old_identifier=current_instance.get("id"),
            epoch=epoch,
        )
    )
