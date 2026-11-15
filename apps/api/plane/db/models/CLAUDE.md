# db/models — Django models

## Purpose

Every table. One file per domain; all exported from `__init__.py`.

## Key files

- `base.py` — BaseModel (UUID id, timestamps, created_by/updated_by, soft delete)
- `workspace.py`, `project.py` — tenancy. `ProjectBaseModel` (in project.py) auto-sets workspace from project.
- `issue.py` — Issue (tasks; `parent` = subtask), IssueRelation (dependencies), IssueActivity, IssueComment, IssueMention, IssueAssignee, IssueLabel, IssueLink, IssueAttachment
- `state.py` — State + StateGroup (backlog/unstarted/started/completed/cancelled/triage)
- `cycle.py` (sprints), `module.py` (keywords), `page.py` (docs), `asset.py` (files)
- `deploy_board.py` — DeployBoard: public published entity via unique `anchor` (our share links)
- `estimate.py`, `label.py`, `view.py`, `notification.py`, `webhook.py`, `api.py` (API tokens)

## Rules

- New project-scoped model → extend `ProjectBaseModel`; workspace-scoped → `WorkspaceBaseModel`.
- Add `db_table`, `ordering`, indexes and unique constraints in `Meta` like existing models.
- Export new models in `__init__.py`.
- Use soft-delete managers where Plane does.
- Add our new models in new files (e.g. `phase.py`, `worklog.py`, `testcase.py`, `ai.py`) to keep upstream merges clean.

## Our changes (Neuric)

- 2026-11-15: `Project.target_date` (DateField, nullable) and `Project.prd_page` (FK Page, SET_NULL, related_name `prd_projects`), under `# Neuric` in project.py. Migration `0126_project_target_date_prd_page`.
- 2026-11-15 (time tracking): `worklog.py` — `IssueWorkLog(ProjectBaseModel)`: issue FK (CASCADE, `issue_worklogs`), user FK (CASCADE, `issue_worklogs`), `started_at`, `duration_minutes` (CheckConstraint `issue_worklog_duration_range` 1..1440), `note`. Indexes (project, started_at), (user, started_at). `user` = whose time, `created_by` = who logged it. Soft-deleted with the issue via `soft_delete_related_objects`. Exported in `__init__.py`.
