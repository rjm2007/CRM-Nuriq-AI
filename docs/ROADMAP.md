# Roadmap

Each step: researcher → human approves → build → ui-reviewer + cloud-reviewer → claude-md-writer → /handoff.

## Step 0 — Foundation
- Fork Plane, run locally (Docker + pnpm dev), create workspace, add Admin + Employees.
- `/claude-md apps/api/plane` and `/claude-md apps/web` and `/claude-md packages` → CLAUDE.md in every code folder.
- Researcher: gap list vs this roadmap. Confirm items in DATA_MODEL.md.
- Add `.env.example`, CI (lint, types, tests), and `docs/API.md`.

## Step 1 — Projects + Tasks
- Project create flow: name, admin, employees, PRD, completion date, description.
- Task fields: keyword, phase, assignee, priority, labels, due date, estimate, dependencies, attachments.
- Subtask rules (one level, due-date limit, progress "3/5", auto-complete parent).
- Time tracking (IssueWorkLog) + roll-up. Activity on tasks AND subtasks.
- My Tasks (check Plane "Your work"), dashboard (check Plane Analytics).

## Step 2 — Keywords + map + phases
- AI suggests keywords from PRD/description; manual fallback.
- Map view of modules + ModuleLink (inspiration: github.com/tt-a1i/archify; check license).
- Phases grouping keywords.

## Step 3 — AI agent
- Transcript → AIJob → AIProposal → human review → create tasks/subtasks.
- Providers: OpenAI API key / Sign in with ChatGPT (confirm eligibility).
- MCP: fork makeplane/plane-mcp-server (MIT); add tools for phases, worklogs, tests, artifacts.

## Step 4 — Docs + artifacts hub

## Step 5 — Sprints (Cycles, custom length)

## Later (agreed)
Test case module, client share links + feedback, developer API docs, feature docs for onboarding.

## Parked
Project templates, global search, automations, bug tracker.

## Open checks
- AGPL obligations if clients use share links of our modified version.
- OpenAI Sign in with ChatGPT for a private internal app.
