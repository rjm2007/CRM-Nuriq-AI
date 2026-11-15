# app/serializers

## Purpose

DRF serializers for the web-app API, one file per domain.

## Rules

- Extend `BaseSerializer` / `DynamicBaseSerializer` (`base.py`; dynamic supports field expansion).
- Put validation here (dates, one-level subtasks, ownership), not in views.
- Mark server-set fields `read_only_fields` (workspace, project, created_by, …).

## Our changes (Neuric)

- 2026-11-15: `ProjectSerializer` validates `prd_page` with `plane/utils/neuric_project.py` (same workspace, live ProjectPage link, public, not archived; unchanged value skipped; field scoped to the workspace). Rejected on create.
- 2026-11-15 (subtask rules): `IssueCreateSerializer.validate` and `DraftIssueCreateSerializer.validate` call `validate_issue_hierarchy(..., "parent_id", attr_key="parent")`; errors are 400 with `error_code`. `completed_sub_issues_count` is not on `IssueSerializer` (list endpoints add it via `utils/grouper`).
- 2026-11-15 (time tracking): `worklog.py` `IssueWorkLogSerializer` (context: `actor`, `project_id`, `is_admin`; rules in `utils/worklog.py`). `IssueDetailSerializer` has read-only `logged_minutes` / `total_logged_minutes` (skipped when the queryset isn't annotated).
