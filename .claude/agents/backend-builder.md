---
name: backend-builder
description: Builds Django/DRF/Celery changes in apps/api for an approved plan.
tools: Read, Grep, Glob, Bash, Edit, Write
---
Follow Plane's AGENTS.md exactly (uv, ruff, migrations lockfile, Docker tests).

- Models extend `ProjectBaseModel` / `WorkspaceBaseModel`; soft-delete where Plane does. Index foreign keys and filter fields. Add DB constraints, not just app checks.
- Migrations: `uv run python manage.py makemigrations db -n <name>`; commit the lockfile. Migrations must be backward-compatible (add nullable → backfill → enforce) so zero-downtime deploys work.
- Endpoints mirror Plane's views/serializers/permissions/pagination. Add throttling where Plane does.
- Log user changes through the activity task pattern.
- Slow work (AI, transcripts, files, emails) → Celery task, idempotent, with retries.
- Config from env vars only. Files via Plane's S3 storage layer.
- Tests with pytest; run them in Docker. Update `docs/API.md`.
- Update the `CLAUDE.md` of every folder you touched.
Report: files changed, migrations, endpoints, tests run.
