# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: parent auto-done.

When a subtask's state changes, ``issue_activity`` calls ``enqueue_parent_rollup``.
``subtask_rollup`` moves the parent to the project's first ``completed`` state when every
live subtask (not deleted, not archived, not draft) is completed or cancelled and at least
one is completed. Cancelled subtasks are ignored. Reopening never changes anything back.
The change is logged as a state activity credited to the user who closed the last subtask.
Pattern: Plane ``issue_automation_task.close_old_issues`` (automated state change + activity).
"""

# Python imports
import json

# Third party imports
from celery import shared_task

# Django imports
from django.db import OperationalError, transaction
from django.utils import timezone

# Module imports
from plane.db.models import Issue, IssueActivity, State, StateGroup
from plane.utils.exception_logger import log_exception

SUBTASK_ROLLUP_COMMENT = "updated the state to (all sub-work items are done)"
ROLLUP_ACTIVITY_KEY = "subtask_rollup"

DONE_GROUPS = {StateGroup.COMPLETED.value, StateGroup.CANCELLED.value}


def enqueue_parent_rollup(issue, activities, actor_id):
    """Enqueue ``subtask_rollup`` for ``issue``'s parent if one of ``activities`` is a state change.

    Never raises: a failure here must not break activity logging.
    """
    try:
        if issue is None or not getattr(issue, "parent_id", None):
            return
        state_changed = any(
            getattr(activity, "field", None) == "state"
            # Guard: the rollup's own activity never triggers another rollup.
            and getattr(activity, "comment", None) != SUBTASK_ROLLUP_COMMENT
            for activity in (activities or [])
        )
        if not state_changed:
            return
        subtask_rollup.delay(
            parent_id=str(issue.parent_id),
            project_id=str(issue.project_id),
            actor_id=str(actor_id) if actor_id else None,
        )
    except Exception as e:
        log_exception(e)


def _rollup_ready(child_groups):
    """Every live child is completed or cancelled, and at least one is completed."""
    return (
        bool(child_groups)
        and all(group in DONE_GROUPS for group in child_groups)
        and StateGroup.COMPLETED.value in child_groups
    )


@shared_task(autoretry_for=(OperationalError,), retry_backoff=True, max_retries=3)
def subtask_rollup(parent_id, project_id, actor_id=None):
    """Move the parent to done if its subtasks allow it. Idempotent: a done parent is skipped."""
    # Imported here: issue_activities_task imports this module.
    from plane.bgtasks.issue_activities_task import issue_activity

    with transaction.atomic():
        parent = (
            Issue.issue_objects.select_for_update(of=("self",))
            .select_related("state")
            .filter(pk=parent_id, project_id=project_id)
            .first()
        )
        if parent is None or parent.state is None or parent.state.group in DONE_GROUPS:
            return None

        child_groups = list(Issue.issue_objects.filter(parent_id=parent.id).values_list("state__group", flat=True))
        if not _rollup_ready(child_groups):
            return None

        done_state = (
            State.objects.filter(project_id=parent.project_id, group=StateGroup.COMPLETED.value)
            .order_by("sequence")
            .first()
        )
        if done_state is None:
            return None

        old_state_id = parent.state_id
        parent.state = done_state
        # Issue._sync_completed_at adds "completed_at" to update_fields.
        parent.save(update_fields=["state", "updated_at"], disable_auto_set_user=True)

        payload = {
            "type": "issue.activity.updated",
            "requested_data": json.dumps({ROLLUP_ACTIVITY_KEY: str(done_state.id)}),
            "current_instance": json.dumps({ROLLUP_ACTIVITY_KEY: str(old_state_id) if old_state_id else None}),
            "issue_id": str(parent.id),
            "project_id": str(parent.project_id),
            "actor_id": actor_id,
            "epoch": int(timezone.now().timestamp()),
            "notification": True,
            "subscriber": False,
        }
        transaction.on_commit(lambda: issue_activity.delay(**payload))
        return str(done_state.id)


def track_subtask_rollup(
    requested_data,
    current_instance,
    issue_id,
    project_id,
    workspace_id,
    actor_id,
    issue_activities,
    epoch,
):
    """``ISSUE_ACTIVITY_MAPPER`` entry: log the automatic parent state change as a state activity."""
    new_state_id = requested_data.get(ROLLUP_ACTIVITY_KEY)
    old_state_id = (current_instance or {}).get(ROLLUP_ACTIVITY_KEY)
    new_state = State.objects.filter(pk=new_state_id, project_id=project_id).first() if new_state_id else None
    old_state = State.objects.filter(pk=old_state_id, project_id=project_id).first() if old_state_id else None
    if new_state is None:
        return
    issue_activities.append(
        IssueActivity(
            issue_id=issue_id,
            actor_id=actor_id,
            verb="updated",
            old_value=old_state.name if old_state else None,
            new_value=new_state.name,
            field="state",
            project_id=project_id,
            workspace_id=workspace_id,
            comment=SUBTASK_ROLLUP_COMMENT,
            old_identifier=old_state.id if old_state else None,
            new_identifier=new_state.id,
            epoch=epoch,
        )
    )
