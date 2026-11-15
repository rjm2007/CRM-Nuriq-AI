# app/serializers

## Purpose

DRF serializers for the web-app API, one file per domain.

## Rules

- Extend `BaseSerializer` / `DynamicBaseSerializer` (`base.py`; dynamic supports field expansion).
- Put validation here (dates, one-level subtasks, ownership), not in views.
- Mark server-set fields `read_only_fields` (workspace, project, created_by, …).

## Our changes (Neuric)

- 2026-11-15: `neuric_project.py` adds `validate_prd_page(page, project)` (same workspace, live ProjectPage link, public, not archived). `ProjectSerializer.validate` rejects `prd_page` on create and checks it on update.
