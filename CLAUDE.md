# Neuric AI CRM (fork of Plane Community Edition)

@AGENTS.md
@docs/progress/CURRENT.md

Internal project-management CRM. Forked from github.com/makeplane/plane (AGPL-3.0, Community Edition only).
Plane's own `AGENTS.md` (imported above) is the source of truth for commands, code style, uv, migrations and tests. Do not contradict it.

## Real stack (checked against Plane's repo)
- `apps/api` — Django + DRF, Celery workers (`worker`, `beat-worker`), deps via **uv**, lint via **ruff**
- `apps/web` — main app (React Router + Vite, MobX stores in `store/`)
- `apps/space` — public pages (our client share links build on this)
- `apps/admin` — instance admin; `apps/live` — real-time collab server; `apps/proxy`
- `packages/*` — shared code. UI primitives from `@makeplane/propel`; composite components in `packages/blocks`
- Services: Postgres (`plane-db`), Redis (`plane-redis`), RabbitMQ (`plane-mq`), MinIO (`plane-minio`)
- Deployment configs: `deployments/` (cli, kubernetes, swarm)

## Golden rules
1. **Don't invent.** Check Plane first, then proven OSS tools (OpenProject, Huly, Vikunja, Focalboard, Taiga). Record the source in `docs/DECISIONS.md`.
2. **Licenses:** AGPL-3.0-compatible sources only (MIT, Apache-2.0, BSD, GPL/AGPL-3.0). Never Plane Commercial/Enterprise code.
3. **One component per job.** Search, modals, pickers, tables, empty states: reuse from propel / `packages/blocks`. New shared pieces go in `packages/blocks`, never inside a page.
4. **APIs follow Plane's style** (`apps/api/plane/api` for public API, `apps/api/plane/app` for the web app). Permission checks, serializer validation, tests, and a line in `docs/API.md` for every endpoint.
5. **Activity:** every new model that users change must log through Plane's activity pipeline (`bgtasks/issue_activities_task.py` pattern) so it shows in the Activity tab.
6. **Cloud-ready from day one:** follow `docs/CLOUD.md` (12-factor config, no secrets in code, stateless containers, S3-compatible storage only).
7. **AI:** in-app agent uses an OpenAI API key or "Sign in with ChatGPT". Claude is used only via Claude Code (each person's own login) + our MCP server. Never store Claude subscription tokens in the app.
8. Small PRs, one feature at a time, tests + `pnpm check` / `ruff` pass before "done".

## CLAUDE.md in every folder (mandatory)
- Every folder we create or substantially change gets its own `CLAUDE.md` (template: `docs/FOLDER_CLAUDE_TEMPLATE.md`).
- Claude Code loads a folder's `CLAUDE.md` automatically when working in it, so keep each one short (under ~60 lines) and specific to that folder.
- When you change a folder's purpose, files, or rules, update its `CLAUDE.md` in the same change.
- Use the `claude-md-writer` agent or `/claude-md <path>` to create/refresh them.

## Session handoff (mandatory)
Many Claude Code chats work on this repo. They share memory through files:
- `docs/progress/CURRENT.md` — live state: what's done, in progress, blocked, next. Loaded automatically (imported above + SessionStart hook).
- `docs/sessions/YYYY-MM-DD-<topic>.md` — one note per chat.
- **At the start** of a chat: read CURRENT.md and the latest 3 session notes. If another chat has something "in progress", don't touch those files without asking.
- **Before ending** a chat (or after any finished step): run `/handoff`. It writes the session note and updates CURRENT.md.

## Our words vs Plane's words
| Ours | Plane |
|---|---|
| Project | `Project` |
| Task / Subtask | `Issue` / `Issue.parent` (we allow one level) |
| Dependencies | `IssueRelation` (blocked_by / blocking) |
| Custom status | `State` (per project, with state groups) |
| Sprint | `Cycle` |
| Keyword | `Module` (verify fit) |
| Phase | NEW (see `docs/DATA_MODEL.md`) |
| Docs | `Page` + `FileAsset` |
| Activity tab | `IssueActivity` |
| Client share link | `DeployBoard` (anchor-based public link) + `apps/space` |
| Time tracking | NEW — not in Community Edition |

## Subagents (`.claude/agents/`)
researcher → (human approves plan) → backend-builder / frontend-builder → ui-reviewer + cloud-reviewer → claude-md-writer → /handoff

## Plan
`docs/ROADMAP.md` (order), `docs/DATA_MODEL.md` (new tables), `docs/CLOUD.md` (infra).
