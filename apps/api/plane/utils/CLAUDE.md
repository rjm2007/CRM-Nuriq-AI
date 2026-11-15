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
- None yet.
