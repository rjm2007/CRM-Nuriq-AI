# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: Activity-tab rows when a keyword (Module) joins, leaves or moves phase (Step 2).

Enqueued by ``plane.utils.keyword_map`` after commit. One ``IssueActivity`` per live work item
(``Issue.issue_objects``: not deleted, archived, draft or triage) in the keyword, per move:
``field="phase"``, ``verb="updated"``, ``old_value`` / ``new_value`` = phase names,
``old_identifier`` / ``new_identifier`` = phase ids, comment ``moved to phase X`` (or
``removed from phase X``). No notifications. Idempotent: a retry skips rows already written for the
same (issue, phases, epoch, actor).
Pattern: Plane ``issue_activities_task`` rows written directly, like ``subtask_rollup_task``.
"""

# Third party imports
from celery import shared_task

# Django imports
from django.db import OperationalError

# Module imports
from plane.db.models import Issue, IssueActivity, Project
from plane.utils.exception_logger import log_exception

PHASE_ACTIVITY_FIELD = "phase"
BATCH_SIZE = 500


def phase_comment(move):
    if move.get("new_phase_name"):
        return f"moved to phase {move['new_phase_name']}"
    return f"removed from phase {move.get('old_phase_name') or ''}".rstrip()


def _issue_ids(project_id, module_id):
    return list(
        Issue.issue_objects.filter(
            project_id=project_id,
            issue_module__module_id=module_id,
            issue_module__deleted_at__isnull=True,
        )
        .values_list("id", flat=True)
        .distinct()
    )


@shared_task(autoretry_for=(OperationalError,), retry_backoff=True, max_retries=3)
def phase_module_activity(project_id, actor_id, moves, epoch):
    """Write the ``phase`` activity rows for ``moves`` (see ``keyword_map._move``). Returns rows created."""
    try:
        project = Project.objects.filter(pk=project_id).values("id", "workspace_id").first()
        if project is None:
            return 0
        created = 0
        for move in moves or []:
            if move.get("old_phase_id") == move.get("new_phase_id"):
                continue
            issue_ids = _issue_ids(project_id, move["module_id"])
            if not issue_ids:
                continue
            already = set(
                IssueActivity.objects.filter(
                    project_id=project_id,
                    issue_id__in=issue_ids,
                    field=PHASE_ACTIVITY_FIELD,
                    epoch=epoch,
                    actor_id=actor_id,
                    old_identifier=move.get("old_phase_id"),
                    new_identifier=move.get("new_phase_id"),
                ).values_list("issue_id", flat=True)
            )
            comment = phase_comment(move)
            rows = [
                IssueActivity(
                    issue_id=issue_id,
                    project_id=project_id,
                    workspace_id=project["workspace_id"],
                    actor_id=actor_id,
                    verb="updated",
                    field=PHASE_ACTIVITY_FIELD,
                    old_value=move.get("old_phase_name"),
                    new_value=move.get("new_phase_name"),
                    old_identifier=move.get("old_phase_id"),
                    new_identifier=move.get("new_phase_id"),
                    comment=comment,
                    epoch=epoch,
                )
                for issue_id in issue_ids
                if issue_id not in already
            ]
            IssueActivity.objects.bulk_create(rows, batch_size=BATCH_SIZE)
            created += len(rows)
        return created
    except OperationalError:
        raise
    except Exception as e:
        log_exception(e)
        return 0
