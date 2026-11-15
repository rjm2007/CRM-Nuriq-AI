# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: Activity-tab rows when a keyword (Module) joins, leaves or moves phase (Step 2).

Enqueued by ``plane.utils.keyword_map`` after commit, one task per ``MOVES_PER_TASK`` moves. One
``IssueActivity`` per live work item (``Issue.issue_objects``: not deleted, archived, draft or triage)
in the keyword, per move: ``field="phase"``, ``verb="updated"``, ``old_value`` / ``new_value`` = phase
names, ``old_identifier`` / ``new_identifier`` = phase ids, comment ``moved to phase X`` (or
``removed from phase X``). No notifications.

Bounded work: one grouped ``ModuleIssue`` query for all moved keywords, streamed with ``.iterator()``
and written in chunks of ``BATCH_SIZE`` rows (each chunk in its own transaction).
Idempotent: a retry skips rows already written for the same (issue, phases, epoch, actor). ``epoch``
is a float timestamp with microseconds taken inside the locking transaction, so two batches never
share it.
Pattern: Plane ``issue_activities_task`` rows written directly, like ``subtask_rollup_task``.
"""

# Third party imports
from celery import shared_task

# Django imports
from django.db import DatabaseError, InterfaceError, transaction

# Module imports
from plane.db.models import Issue, IssueActivity, ModuleIssue, Project
from plane.utils.exception_logger import log_exception

PHASE_ACTIVITY_FIELD = "phase"
BATCH_SIZE = 500
MOVES_PER_TASK = 50
RETRYABLE_ERRORS = (DatabaseError, InterfaceError)


def phase_comment(move):
    if move.get("new_phase_name"):
        return f"moved to phase {move['new_phase_name']}"
    return f"removed from phase {move.get('old_phase_name') or ''}".rstrip()


def chunk_moves(moves, size=MOVES_PER_TASK):
    """Split ``moves`` into lists of at most ``size`` (one task each)."""
    return [moves[i : i + size] for i in range(0, len(moves), size)]


def _module_issue_pairs(project_id, module_ids):
    """(module_id, issue_id) for every live work item in the given keywords, streamed in a stable order."""
    live_issues = Issue.issue_objects.filter(project_id=project_id).values("id")
    return (
        ModuleIssue.objects.filter(
            project_id=project_id,
            module_id__in=module_ids,
            deleted_at__isnull=True,
            issue_id__in=live_issues,
        )
        .order_by("module_id", "issue_id")
        .values_list("module_id", "issue_id")
        .distinct()
        .iterator(chunk_size=BATCH_SIZE)
    )


def _write(rows, project_id, actor_id, epoch):
    """Insert ``rows`` minus those a previous attempt already wrote. Returns the number inserted."""
    if not rows:
        return 0
    with transaction.atomic():
        already = set(
            IssueActivity.objects.filter(
                project_id=project_id,
                issue_id__in={row.issue_id for row in rows},
                field=PHASE_ACTIVITY_FIELD,
                epoch=epoch,
                actor_id=actor_id,
            ).values_list("issue_id", "old_identifier", "new_identifier")
        )

        def key(row):
            return (
                row.issue_id,
                str(row.old_identifier) if row.old_identifier else None,
                str(row.new_identifier) if row.new_identifier else None,
            )

        already = {(i, str(o) if o else None, str(n) if n else None) for i, o, n in already}
        fresh = [row for row in rows if key(row) not in already]
        IssueActivity.objects.bulk_create(fresh, batch_size=BATCH_SIZE)
    return len(fresh)


@shared_task(
    autoretry_for=RETRYABLE_ERRORS,
    max_retries=5,
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    acks_late=True,
    soft_time_limit=240,
    time_limit=300,
)
def phase_module_activity(project_id, actor_id, moves, epoch):
    """Write the ``phase`` activity rows for ``moves`` (see ``keyword_map._move``). Returns rows created.

    Database errors propagate so Celery retries; anything else is logged and the task returns 0.
    """
    try:
        project = Project.objects.filter(pk=project_id).values("id", "workspace_id").first()
        if project is None:
            return 0
        by_module = {}
        for move in moves or []:
            if move.get("old_phase_id") == move.get("new_phase_id"):
                continue
            by_module.setdefault(str(move["module_id"]), []).append(move)
        if not by_module:
            return 0
        comments = {id(move): phase_comment(move) for group in by_module.values() for move in group}
        created = 0
        buffer = []
        for module_id, issue_id in _module_issue_pairs(project_id, list(by_module)):
            for move in by_module[str(module_id)]:
                buffer.append(
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
                        comment=comments[id(move)],
                        epoch=epoch,
                    )
                )
            if len(buffer) >= BATCH_SIZE:
                created += _write(buffer, project_id, actor_id, epoch)
                buffer = []
        created += _write(buffer, project_id, actor_id, epoch)
        return created
    except RETRYABLE_ERRORS:
        raise
    except Exception as e:
        log_exception(e)
        return 0
