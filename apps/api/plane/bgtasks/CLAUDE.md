# bgtasks — Celery tasks

## Key files
- `issue_activities_task.py` — **activity log pipeline.** `issue_activity` task dispatches by type via `ACTIVITY_MAPPER`; per-field trackers `track_state`, `track_parent`, `track_assignees`, …
- `issue_automation_task.py` — auto-archive / auto-close old issues (beat)
- `notification_task.py`, `email_notification_task.py` — in-app + email notifications
- `webhook_task.py`, `export_task.py`, `file_asset_task.py`, `deletion_task.py`, `cleanup_task.py`

## Rules
- Tasks idempotent, with retries/timeouts; pass IDs, not objects.
- New activity types: add a tracker + mapper entry following existing ones.
- Our planned tasks: `subtask_rollup_task.py` (auto-complete parent), `ai_tasks.py` (keywords, transcript → proposal).
- Schedules go in `plane/celery.py` beat config.

## Our changes (Neuric)
- None yet.
