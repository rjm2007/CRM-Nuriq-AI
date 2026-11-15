# apps/api — Django backend

## Purpose

Plane's backend: REST APIs, background jobs (Celery), DB models and migrations.

## Key files

- `plane/` — all Django code (see `plane/CLAUDE.md`)
- `pyproject.toml` + `uv.lock` — dependencies (uv). Commit both.
- `migrations_lockfile.txt` — written by makemigrations. Never edit by hand.
- `ruff.toml` — lint rules. `pytest.ini`, `run_tests.sh` — tests.
- `Dockerfile.api` (prod), `Dockerfile.dev` (local)

## Rules

- Follow root `AGENTS.md` for uv, migrations and Docker tests.
- Add deps with `uv add <pkg>==<version>`; pinned versions only.
- New migration: `uv run python manage.py makemigrations db -n <name>`.

## How to test

See root AGENTS.md "Backend tests (Docker)". Lint: `uv run ruff check .`

## Our changes (Neuric)

- 2026-11-15 (time tracking): migration `0127_issue_worklog` (made in the container with `docker exec crm-api-1 python manage.py makemigrations db -n issue_worklog`); lockfile updated.
