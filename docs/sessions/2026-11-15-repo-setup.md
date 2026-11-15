# Repo setup + local Plane run — 2026-11-15

## Goal

Create the Nuriq AI CRM repo from Plane CE, add the planning kit, push to GitHub, and run Plane locally.

## Done (files changed)

- Repo initialised in `~/Desktop/CRM` from `makeplane/plane` `preview` (commit `290383d7f9`).
  - Remotes: `upstream` = makeplane/plane, `origin` = rjm2007/CRM-Nuriq-AI. Branch `main`.
- Kit copied into repo root (50 files: `CLAUDE.md`, `SETUP.md`, `.claude/agents|commands|settings.json`, `docs/*`, 28 `apps/api/**/CLAUDE.md`). No Plane file was overwritten.
- `.gitignore`: removed Plane's `CLAUDE.md` ignore line so per-folder CLAUDE.md files are tracked.
- Commit `e9c22711e6` "Add Nuriq AI CRM kit (CLAUDE.md, agents, docs)" pushed to `origin/main` (repo was empty).
- Local run per CONTRIBUTING.md: `corepack enable` → `./setup.sh` (env files + `pnpm install`, pnpm 11.10.0) → `docker compose -f docker-compose-local.yml up -d --build` → `pnpm dev`.
  - All containers up, migrations applied, API :8000 OK; web :3000, admin :3001/god-mode/, space :3002/spaces/, live :3100 all serving.
- Kit source moved (not deleted) to `~/Desktop/CRM-kit-source/` because the CRM folder had to be empty.

## Decisions (and why)

- Used `git init` + `fetch` instead of `git clone`: the folder held a `.DS_Store`, and we never delete without asking. Result is identical.
- `main` created from `preview` (Plane's default branch). Upstream merges later: `git fetch upstream && git merge upstream/preview`.
- Tracked CLAUDE.md files despite Plane ignoring them: the kit requires a shared CLAUDE.md in every folder. Expect a small `.gitignore` conflict on upstream merges.
- Did not copy the stray top-level `CLAUDE.md` (it duplicates `apps/api/plane/db/models/CLAUDE.md`) or `GAP_LIST.md` (it duplicates `docs/GAP_LIST.md`).

## Not done / in progress (files touched)

- This handoff (this file + `docs/progress/CURRENT.md`) is not committed yet.
- Instance admin account not created yet (manual browser step).

## Blockers / questions for the team

- Docker Desktop has ~6 GB RAM; Plane recommends 12 GB total. It runs, but raise Docker's memory if builds or containers crash.
- AGPL check for client share links is still open (from planning).

## Next step (exact prompt the next chat can paste)

```
/start
Then: run `/claude-md apps/web` and `/claude-md packages` to write the frontend CLAUDE.md files, following docs/FOLDER_CLAUDE_TEMPLATE.md.
```
