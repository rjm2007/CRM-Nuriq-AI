# app/urls — web-app routes

## Rules

- One file per domain; register it in `__init__.py`.
- Follow existing path shape: `workspaces/<slug>/projects/<project_id>/<resource>/`.

## Our changes (Neuric)

- 2026-11-15 (time tracking): `issue.py` routes `issues/<issue_id>/worklogs/`, `.../worklogs/<pk>/`, `projects/<project_id>/worklogs/` and `.../worklogs/summary/`.
