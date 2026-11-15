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
- None yet.
