# tests

## Structure (see README.md / TESTING_GUIDE.md)
- `unit/` — models, serializers, utils, bg_tasks, views, middleware, settings
- `contract/api/` — public API (`api_key_client` fixture)
- `contract/app/` — web-app API (`session_client` fixture)
- `smoke/` — app boots
- `factories.py`, `conftest.py` — fixtures

## Rules
- Every new endpoint: contract test incl. permission/scope tests (copy style of `test_*_scope_app.py`).
- Every new model rule (one-level subtasks, due-date limit, parent auto-complete): unit test.
- Run in Docker per root AGENTS.md.

## Our changes (Neuric)
- None yet.
