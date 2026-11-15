# app/views/issue — tasks & subtasks

## Key files

- `base.py` — issue CRUD, list with filters/grouping
- `sub_issue.py` — subtasks (children via `parent`)
- `relation.py` — dependencies (blocked_by/blocking, relates_to, duplicate)
- `activity.py` — Activity tab feed (activities + comments)
- `comment.py`, `reaction.py`, `attachment.py`, `link.py`, `label.py`, `subscriber.py`, `archive.py`, `version.py`

## Our planned changes

- Subtasks one level deep + due date ≤ parent (validate in serializer).
- Progress "x/y done" on parent.
- Auto-complete parent when all subtasks are in a completed state group (Celery, off activity pipeline).
- Work log endpoints (new file `worklog.py`).

## Our changes (Neuric)

- 2026-11-15 (subtask rules): `sub_issue.py` POST runs `validate_bulk_attach` before `bulk_update` (all or nothing, 400 `{error, error_code, issue_ids}`). `base.py`: `IssueBulkUpdateDateEndpoint` runs `validate_bulk_target_dates` before any update/activity; `completed_sub_issues_count` added to the list/create `.values()` lists and `IssuePaginatedViewSet` (annotation + field). Rules live in `plane/utils/subtask_rules.py`.
- 2026-11-15 (time tracking): `worklog.py` — `IssueWorkLogViewSet` (list/create/partial_update/destroy), `ProjectWorkLogEndpoint` (paginated), `ProjectWorkLogSummaryEndpoint`. `allow_permission([ADMIN, MEMBER])` + `require_time_access` (denies a workspace admin whose project role is GUEST); issue list capped at 1000; the flag gates writes only; members edit their own entries, project admins any. Activity `worklog.activity.*`, `notification=False`. `base.py`: retrieve + `IssueDetailIdentifierEndpoint` annotate `logged_minutes`/`total_logged_minutes`; `total_logged_minutes` in the list `.values()` and `IssuePaginatedViewSet`; all only when `can_view_time` (guests get no keys). `archive.py` passes `with_time_totals=`. `activity.py` drops `worklog` rows for guests.
