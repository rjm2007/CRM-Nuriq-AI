# api/serializers — public API serializers

## Rules

- Extend `base.py` BaseSerializer. Explicit fields only (no `__all__`) so the public contract is stable.

## Our changes (Neuric)

- 2026-11-15 (subtask rules): `IssueSerializer.validate` calls `validate_issue_hierarchy(..., "parent")`; 400 with `error_code`.
- 2026-11-15 (time tracking): `worklog.py` `IssueWorkLogSerializer` and `WorkLogSummarySerializer` (OpenAPI only). `IssueSerializer` has read-only `logged_minutes` / `total_logged_minutes` (only when annotated: the detail endpoint).
