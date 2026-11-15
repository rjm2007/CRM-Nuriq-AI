# app/serializers

## Purpose
DRF serializers for the web-app API, one file per domain.

## Rules
- Extend `BaseSerializer` / `DynamicBaseSerializer` (`base.py`; dynamic supports field expansion).
- Put validation here (dates, one-level subtasks, ownership), not in views.
- Mark server-set fields `read_only_fields` (workspace, project, created_by, …).

## Our changes (Neuric)
- None yet.
