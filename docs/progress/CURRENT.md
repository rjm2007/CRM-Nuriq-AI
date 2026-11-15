# Current progress (shared across all Claude Code chats)

_Last updated: 2026-11-15 by repo-setup chat (docs/sessions/2026-11-15-repo-setup.md)_

## Done

- Scope agreed; fork Plane CE.
- Kit: CLAUDE.md, agents, commands, docs.
- Step 0 (backend part): CLAUDE.md written for 28 backend folders under apps/api; backend gap list in docs/GAP_LIST.md.
- Repo created from Plane `preview`, kit committed, pushed to github.com/rjm2007/CRM-Nuriq-AI (`main`). Remotes: `origin` (ours), `upstream` (Plane).
- Plane runs locally: Docker stack (`docker-compose-local.yml`) + `pnpm dev`. Web :3000, admin :3001/god-mode/, space :3002/spaces/, API :8000.

## In progress

- (none)

## Blocked / waiting

- AGPL check for client share links.

## Next

1. Each dev: create the instance admin at http://localhost:3001/god-mode/, then log in at http://localhost:3000.
2. `/claude-md apps/web` and `/claude-md packages` (frontend CLAUDE.md files).
3. Frontend gap check (My Tasks, analytics, layouts).
4. Step 1 backend, in the order at the bottom of docs/GAP_LIST.md.

## Notes

- `.gitignore` was changed to track CLAUDE.md files (Plane ignores them). Watch for a conflict when merging `upstream/preview`.
- Local dev needs ~12 GB RAM; give Docker Desktop more memory if containers crash.
