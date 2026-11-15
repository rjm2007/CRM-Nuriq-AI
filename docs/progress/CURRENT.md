# Current progress (shared across all Claude Code chats)

_Last updated: 2026-11-16 by step1 chat (docs/sessions/2026-11-16-step1-projects-tasks.md)_

## Done

- Scope agreed; fork Plane CE. Kit: CLAUDE.md, agents, commands, docs.
- Repo on github.com/rjm2007/CRM-Nuriq-AI (`main`). Remotes: `origin` (ours), `upstream` (Plane).
- Plane runs locally: Docker stack + `pnpm dev`. Instance admin + workspace `neuric` created (admin@neuric.test).
- **Step 0 done:** CLAUDE.md for apps/api (28), apps/web (9+), packages (15); backend + frontend gap lists in docs/GAP_LIST.md.
- **Step 1 done** (branch `feat/subtask-rules`, pushed; PR to `main` opened by user):
  - Project completion date + PRD page (with stale-link cleanup)
  - Pick members while creating a project
  - Subtask rules: one level, due ≤ parent, done/total on cards, parent auto-done
  - Time tracking: log time on work items, totals incl. subtasks, Activity rows, settings toggle
  - "My Tasks" (renamed "Your work", opens Assigned); Modules (keywords) on by default
  - Tested: Playwright UI + live API E2E + backend unit/contract tests; cloud + UI reviews done and fixed.

## In progress

- Step 2 (keywords + phases + map) on branch `feat/step2-keywords-phases` — PARTIAL (commit 44d3a6ccd6, stopped by usage limit). Done: models + migration 0128, serializers, keyword_map services, phase activity task; web types/store/service/PhaseSelect. TODO: views+URLs+tests (api), phases settings page, Keywords relabel, phase on keyword UI + task sidebar row, activity renderer. Map needs OK to install `@xyflow/react` 12.12.1 (MIT).

## Blocked / waiting

- AGPL check for client share links.
- "Sign in with ChatGPT" eligibility for a private internal app.

## Next

1. Merge the Step 1 PR after review.
2. Step 2: keywords + map + phases (researcher first: Phase, PhaseModule, ModuleLink; Archify license).
3. Step 3: AI agent (transcript → proposals), OpenAI key / ChatGPT sign-in, MCP server fork.
4. Later: analytics "Time" tab, Nuriq branding + source-code offer before clients, cloud deployment.

## Notes

- `.gitignore` was changed to track CLAUDE.md files (Plane ignores them). Watch for a conflict when merging `upstream/preview`.
- Local dev needs ~12 GB RAM; Docker has ~6 GB. If containers crash, raise Docker's memory.
- Commits: no Claude/AI attribution lines (user rule).
- Backend tests: run inside `crm-api-1` (`docker exec crm-api-1 python -m pytest ...`), one run at a time (shared test DB). Magic-link auth tests fail locally (no SMTP) — expected.
- Pre-commit hook runs `oxlint --deny-warnings` on touched files: fix existing warnings in files you edit.
- Neuric routes go in `apps/web/app/routes/extended.ts`; new shared UI in `packages/blocks`.
- Restart `crm-worker-1` after adding Celery tasks.
