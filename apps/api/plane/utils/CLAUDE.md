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
- 2026-11-15 (time tracking): `worklog.py` — `logged_minutes_expr()` / `total_logged_minutes_expr()` (one SUM subquery each; archived subtasks counted, deleted ones not), `ensure_time_tracking_enabled` (403 `TIME_TRACKING_DISABLED`), `can_manage_worklog`, `can_access_time_tracking`, serializer rules (`validate_worklog_attrs`), filters (`apply_worklog_filters`, 400 `INVALID_WORKLOG_FILTER`), `worklog_summary`, `worklog_errors` (flattens `error_code` to a string). `grouper.issue_queryset_grouper` annotates `total_logged_minutes` unless `with_time_totals=False`; `issue_on_results` returns it only when annotated.
