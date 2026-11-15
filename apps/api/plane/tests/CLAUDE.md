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

- 2026-11-15: `factories.py` adds `PageFactory` and `link_page_to_project()`. Tests: `contract/app/test_project_target_prd_app.py`, `contract/api/test_projects_target_prd.py`, `unit/serializers/test_project_prd_page.py`.
