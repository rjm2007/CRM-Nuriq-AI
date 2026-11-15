# apps/web/services — API clients

## Purpose

Thin axios clients that call the Django API (`apps/api/plane/app` URLs, `/api/workspaces/<slug>/...`). One class per resource.
Parent: `../CLAUDE.md`.

## Key files

- `api.service.ts` — abstract `APIService`: axios with `withCredentials` (session cookie), trailing-slash normalization (`normalizeAPIRequestURL` from `@plane/services`), 401 -> redirect to `/?next_path=...`
- `issue/` — issue, activity, archive, attachment, comment, label, reaction, relation, versions, workspace drafts
- `project/` — project, archive, export, member, publish (DeployBoard), state
- `page/`, `inbox/`, `favorite/`, `integrations/` (github, jira)
- Single files: `cycle`, `cycle_archive`, `module`, `module_archive`, `view`, `analytics`, `dashboard`, `estimate`, `workspace`, `workspace-notification`, `user`, `auth`, `instance`, `file`, `file-upload`, `sticky`, `webhook`, `timezone`, `ai`, `app_config`, `app_installation`, `issue_filter`

## Rules for this folder

- Extend `APIService` and call `super(API_BASE_URL)` (`@plane/constants`).
- Methods are `async`, typed with `@plane/types`, and follow the pattern
  `.then((res) => res?.data).catch((err) => { throw err?.response?.data; })`.
- No MobX, no React, no UI side effects (toasts belong to components).
- Keep URLs matching the backend routes exactly, including the trailing slash style of the endpoint.
- Every new endpoint used here must exist in `apps/api` with permissions + tests and a line in `docs/API.md` (root rule 4).
- Services shared with other apps belong in `packages/services`.

## Depends on / used by

- Uses: `axios`, `@plane/constants`, `@plane/types`, `@plane/services`.
- Used by: `store/*` (main path) and some components/hooks for one-off fetches (often with SWR).

## How to test

`pnpm turbo run check:types --filter=web`; hit the endpoint against the local API on :8000.

## Our changes (Neuric)

- Our changes (Neuric) 2026-11-15, time tracking: `issue/issue_worklog.service.ts` (`IssueWorkLogService`: issue list/create/update/remove under `.../issues/<id>/worklogs/`, `listProjectWorkLogs` (paginated) and `getProjectSummary` under `.../projects/<id>/worklogs/`), exported from `issue/index.ts`.
- Our changes (Neuric) 2026-11-16: `issue/issue_worklog.service.ts` errors are `{ ...body, status }` (HTTP status passed through for the toast mapping).
