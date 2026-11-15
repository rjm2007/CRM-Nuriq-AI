# api — public API (`/api/v1/`)

## Purpose

External API with `X-Api-Key` auth (`middleware/api_authentication.py`), rate-limited (`rate_limit.py`). Used by the MCP server, Claude Code / Codex, and our developer API docs.

## Map

- `views/` (extend `BaseAPIView`/`BaseViewSet` from `views/base.py`), `serializers/`, `urls/` (incl. `schema.py` → OpenAPI)

## Rules

- Anything the MCP / AI agent must do needs an endpoint here.
- Keep it stable: never break existing fields; add, don't rename.
- Document with OpenAPI annotations (see `utils/openapi/`). Contract tests in `tests/contract/api/`.

## Our changes (Neuric)

- 2026-11-15: v1 projects: `target_date` on create+update, `prd_page` on update only (field-level `validate_prd_page` on `ProjectUpdateSerializer`, so errors are 400; the patch view turns ValidationErrors raised in `save()` into 409). OpenAPI project examples updated.
- 2026-11-15 (time tracking): v1 time entries (`views/worklog.py`, `serializers/worklog.py`, `urls/worklog.py`); the work item detail returns `logged_minutes` / `total_logged_minutes`.
