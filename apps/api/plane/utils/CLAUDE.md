# utils — shared helpers

## Key areas

- `paginator.py`, `global_paginator.py` — pagination (use these, don't roll your own)
- `issue_filters.py`, `filters/` — filter parsing / filtersets
- `issue_search.py`, `grouper.py`, `order_queryset.py` — list views
- `core/mixins` — ReadReplicaControlMixin etc.
- `openapi/` — OpenAPI helpers for the public API
- `exporters/`, `porters/` — import/export
- `url_security.py`, `path_validator.py`, `content_validator.py`, `html_processor.py` — input safety
- `exception_logger.py`, `logging.py`, `otlp_endpoints.py` — observability

## Rules

- Reuse before writing a new helper. New helpers go here only if used by 2+ modules.
- `permissions/` here is a near-duplicate of `app/permissions`; prefer `app/permissions`.

## Our changes (Neuric)

- 2026-11-15: `neuric_project.py` — `validate_prd_page`, `clear_prd_page_links` (called from page views when a page goes private, is archived or deleted).
- 2026-11-15: `subtask_rules.py` — one-level subtask + due-date rules (`validate_issue_hierarchy`, `validate_bulk_attach`, `validate_bulk_target_dates`, `SubtaskRuleError` codes), search filters, and `completed_sub_issues_count_expr()` (added in `grouper.issue_queryset_grouper` + `issue_on_results`).
- 2026-11-15 (time tracking): `worklog.py` — `logged_minutes_expr()` / `total_logged_minutes_expr()` (total = own SUM + subtasks SUM, two indexed subqueries, no OR; archived subtasks counted, deleted ones not), `ensure_time_tracking_enabled` (403 `TIME_TRACKING_DISABLED`), `can_manage_worklog`, `can_view_time(user, project_id, slug)` (the one time-visibility rule: active project ADMIN/MEMBER; a workspace admin with project role GUEST is a guest), `can_access_time_tracking` (= `can_view_time`), `require_time_access` (view decorator, 403), `time_annotations(show)`, `total_logged_minutes_for_viewer_expr(user)` (cross-project lists: NULL in guest projects), `worklog_activity_visible_q(user)`, serializer rules (`validate_worklog_attrs`), filters (`apply_worklog_filters`, 400 `INVALID_WORKLOG_FILTER`; max 100 users, gte < lt; `include_subtasks` is an `issue_id IN` list), `started_at` >= 2000-01-01, `project_worklog_queryset` skips archived projects, `worklog_summary`, `worklog_errors` (flattens `error_code` to a string). `grouper.issue_queryset_grouper` annotates `total_logged_minutes` only with `with_time_totals=True` (default False; callers pass `can_view_time(...)`); `issue_on_results` returns it only when annotated.
