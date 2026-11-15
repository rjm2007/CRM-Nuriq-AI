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
- None yet.
