# api/urls — public API routes

## Rules

- One file per resource; `work_item.py` = issues. `schema.py` serves the OpenAPI schema.
- New resources: add file + register in `__init__.py`.

## Our changes (Neuric)

- 2026-11-15 (time tracking): `worklog.py` — worklog routes under `issues/` and `work-items/`, plus `projects/<id>/worklogs/` and `.../summary/`; included from `__init__.py`.
