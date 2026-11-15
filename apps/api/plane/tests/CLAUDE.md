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
- 2026-11-15 (time tracking): `factories.py` adds `IssueWorkLogFactory`. Tests: `unit/models/test_issue_worklog.py`, `unit/serializers/test_worklog_serializer.py`, `unit/utils/test_worklog_utils.py`, `unit/bg_tasks/test_worklog_activity.py`, `contract/app/test_worklog_app.py`, `contract/api/test_worklog_api.py` (contract tests run Celery eagerly; include guest / workspace-admin-guest visibility tests), `contract/app/test_worklog_space_app.py` (public share-link issue list: 200, no time fields).
- 2026-11-16 (Step 2 keyword map): `factories.py` adds `ModuleFactory`, `PhaseFactory`. Tests: `unit/models/test_keyword_map_models.py` (DB constraints), `unit/utils/test_keyword_map.py` (service rules, soft-delete cascade), `unit/bg_tasks/test_phase_activity.py` (fan-out, idempotent, retries, chunking, sub-second back-and-forth), `contract/app/test_phase_app.py`, `contract/api/test_phase_api.py` (roles: admin/member/guest/non-member; guest reads need `guest_view_all_features`). `on_commit` work runs via `django_capture_on_commit_callbacks(execute=True)` + eager Celery.
