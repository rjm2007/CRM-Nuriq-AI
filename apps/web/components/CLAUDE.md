# apps/web/components — feature UI

## Purpose

All web-app React components, grouped by feature (~57 folders, ~1400 files). Pages in `app/` import from here.
Parent: `../CLAUDE.md`.

## Key subfolders

- `issues/` — work items: `issue-layouts/` (list, kanban, calendar, spreadsheet, gantt, `roots/`, `filters/`, `quick-add/`, `properties/`), `issue-detail/`, `issue-modal/`, `peek-overview/`, `relations/`, `bulk-operations/`, `workspace-draft/`
- `base-layouts/` — generic list/kanban/gantt layout shells + `layout-switcher.tsx` (reusable, not issue-specific)
- `gantt-chart/` — timeline engine used by gantt layouts
- `profile/` — "Your work" UI (`profile-issues.tsx`, `overview/`, `activity/`, `sidebar.tsx`)
- `analytics/` — Analytics tabs (`overview/`, `work-items/`, `insight-table/`, `select/`)
- `home/` — workspace home dashboard + `widgets/`
- `workspace/` — workspace settings forms, `sidebar/` (main nav; `sidebar-menu-items.tsx` builds static items)
- `project/`, `projects/`, `cycles/`, `modules/`, `views/`, `pages/`, `inbox/`, `estimates/`, `labels/`, `project-states/`, `archives/`, `active-cycles/`, `stickies/`
- `dropdowns/` — pickers (state, member, label, cycle, module, priority, project, estimate, date)
- `rich-filters/`, `work-item-filters/` — filter builder UI
- `power-k/` — command palette (Cmd+K), navigation commands, shortcuts
- `navigation/`, `sidebar/`, `breadcrumbs/` — app chrome
- `settings/` — settings page scaffolding (profile/workspace/project)
- `core/`, `common/`, `ui/` — app-local shared bits (app-header, content-wrapper, page-title, activity, loaders, filters)
- `editor/`, `comments/`, `empty-state/`, `modals/`, `onboarding/`, `auth-screens/`, `account/`, `exporter/`, `web-hooks/`, `api-token/`, `integration/`

## Rules for this folder

- Primitives from `@makeplane/propel/components/*` (Button, Tooltip, ...), icons from `@makeplane/propel/icons`.
- Composites from `@plane/blocks/<subpath>` (`toast`, `breadcrumb`, `empty-state`, `layout`, `icons`, `emoji-icon-picker`, ...). Never import the `@plane/blocks` root.
- Before writing a new search/modal/picker/table/empty state, check propel, `packages/blocks`, then `dropdowns/`, `core/`, `common/`. New cross-app pieces go in `packages/blocks`.
- Wrap store-reading components with `observer` from `mobx-react`; read state via `@/hooks/store/*`, never import `store/` directly.
- No direct API calls; go through store actions (or a service for one-off fetches with SWR).
- All visible text via `useTranslation()` from `@plane/i18n`.
- Files named `extended-*` are Plane's extension seams; put Neuric additions there or in new folders to limit merge conflicts.

## Depends on / used by

- Uses: `@/hooks`, `@/helpers`, `@plane/{blocks,constants,types,utils,i18n,editor}`, `@makeplane/propel`.
- Used by: `app/` pages and layouts.

## How to test

`pnpm turbo run check:types --filter=web` and `check:lint`; no component tests exist in apps/web.

## Our changes (Neuric)

- 2026-11-15: project `target_date` + `prd_page`. `projects/create/attributes.tsx` (target-date `DateSelect` pill, now an `observer`), `projects/create/utils.ts` (default `target_date: null`), `project/form.tsx` (payload + `prd_page` 400 toast), new `project/form-target-prd.tsx` (`ProjectTargetDateField`, `ProjectPrdPageField` using `PageSelect` with the project's public non-archived pages from the project page store, "Open PRD" link, missing/past-date hints, `isProjectTargetDatePast`), `project/card.tsx` (target-date pill, red when overdue and not archived).
- 2026-11-15 (review fixes): `project/form-target-prd.tsx` loads pages via `useSWR("PROJECT_PAGES_${projectId}")` (shared with the pages layout), waits for the store `loader` before flagging a missing PRD (`role="alert"`), sorts options with `orderPages`, clear row, "Open PRD" only for the saved `prd_page` (new tab; `savedPrdPageId` prop from `form.tsx`). Overdue rule moved to `@plane/utils` `isProjectTargetDateOverdue` (due today counts); `isProjectTargetDatePast` removed. `project/card.tsx` tooltip + sr-only "Overdue". Create-modal pill `testId="create-project-target-date-select"`.
