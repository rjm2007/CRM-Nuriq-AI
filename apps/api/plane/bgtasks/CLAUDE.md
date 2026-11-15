# bgtasks — Celery tasks

## Key files

- `issue_activities_task.py` — **activity log pipeline.** `issue_activity` task dispatches by type via `ACTIVITY_MAPPER`; per-field trackers `track_state`, `track_parent`, `track_assignees`, …
- `issue_automation_task.py` — auto-archive / auto-close old issues (beat)
- `notification_task.py`, `email_notification_task.py` — in-app + email notifications
- `webhook_task.py`, `export_task.py`, `file_asset_task.py`, `deletion_task.py`, `cleanup_task.py`

## Rules

- Tasks idempotent, with retries/timeouts; pass IDs, not objects.
- New activity types: add a tracker + mapper entry following existing ones.
- Our planned tasks: `ai_tasks.py` (keywords, transcript → proposal).
- Schedules go in `plane/celery.py` beat config.

## Our changes (Neuric)

- 2026-11-15: `subtask_rollup_task.py` — parent auto-done. `issue_activity` calls `enqueue_parent_rollup` after `bulk_create` (child `state` activity only; the rollup's own activity is skipped). `subtask_rollup` locks the parent, moves it to the lowest-sequence `completed` state when every live child is completed/cancelled and one is completed, then logs a `state` activity via the `subtask_rollup` key in `ISSUE_ACTIVITY_MAPPER` (`track_subtask_rollup`). Registered in `CELERY_IMPORTS`.
