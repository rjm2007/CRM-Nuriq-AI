# plane — Django project root

## Purpose

All backend modules.

## Map

- `db/` — models, migrations, management commands. **Start here for any data change.**
- `app/` — web-app API at `/api/` (session auth). Used by apps/web.
- `api/` — public API at `/api/v1/` (X-Api-Key auth). Used by MCP server, integrations, our developer API.
- `space/` — public/no-login API for published boards (our client share links).
- `authentication/` — login, sessions, OAuth providers.
- `bgtasks/` — Celery tasks (activity log, emails, exports, automation).
- `utils/` — shared helpers: permissions, filters, pagination, search.
- `settings/` — Django settings per environment.
- `middleware/`, `throttles/`, `license/`, `analytics/`, `web/`, `seeds/`, `tests/`
- `celery.py` — Celery app + beat schedule. `urls.py` — root URL routing.

## Rules

- Web-app features → `app/`. Anything external tools/MCP need → also expose in `api/`.
- Public (no-login) endpoints only in `space/`, always scoped by DeployBoard anchor.
- Slow work → `bgtasks/`, never inside a request.

## Our changes (Neuric)

- 2026-11-15 (time tracking): IssueWorkLog time entries across `db/`, `utils/worklog.py`, `app/`, `api/`, `bgtasks/worklog_activity.py`; see those folders' notes and docs/API.md.
- 2026-11-16 (Step 2 keyword map): Phase / PhaseModule / ModuleRelation across `db/`, `utils/keyword_map.py`, `app/views/phase/`, `api/views/phase.py`, `bgtasks/phase_activity.py`; see docs/API.md.
