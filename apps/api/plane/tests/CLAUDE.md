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
- 2026-11-15: `factories.py` adds `StateFactory`, `IssueFactory`. Subtask tests: `unit/utils/test_subtask_rules.py`, `unit/serializers/test_issue_subtask_rules.py`, `unit/bg_tasks/test_subtask_rollup_task.py` (needs `django_db(transaction=True)` for `on_commit`), `contract/app/test_subtask_rules_app.py`, `contract/api/test_subtask_rules_api.py`.
- 2026-11-15 (time tracking): `factories.py` adds `IssueWorkLogFactory`. Tests: `unit/models/test_issue_worklog.py`, `unit/serializers/test_worklog_serializer.py`, `unit/utils/test_worklog_utils.py`, `unit/bg_tasks/test_worklog_activity.py`, `contract/app/test_worklog_app.py`, `contract/api/test_worklog_api.py` (contract tests run Celery eagerly).
