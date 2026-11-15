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
- Our changes (Neuric) 2026-11-15, subtask rules: `issues/issue-layouts/properties/all-properties.tsx`, `list/block.tsx` (chevron aria-label), `spreadsheet/columns/sub-issue-column.tsx` show `done/total` via `formatSubIssuesProgress` (falls back to the total). `issue-detail-widgets/sub-issues/quick-action-button.tsx` and `action-buttons.tsx` hide "add sub-work item" on a sub-work item (also covers title actions + peek). `issue-detail/parent-select.tsx` disables "add parent" (tooltip) when the item has sub-work items; `issue-modal/components/default-properties.tsx` hides it when editing such an item and caps the due date at the parent's. `issue-detail/detail-meta-row.tsx` caps the due date (`useParentIssue`). Toasts use `getSubtaskRuleError` (`@plane/utils`) in `issue-detail/root.tsx`, `peek-overview/root.tsx`, `issue-modal/base.tsx`, `issue-detail-widgets/sub-issues/helper.ts`, `issue-layouts/gantt/base-gantt-root.tsx`. `issue-detail/issue-activity/activity/actions/state.tsx` adds "(all sub-work items done)" when `activity.comment === SUBTASK_ROLLUP_COMMENT`. Existing no-shadow/lint warnings in these files fixed (renames only).
- Our changes (Neuric) 2026-11-15, subtask rules review fixes: `issue-layouts/properties/all-properties.tsx` caps the due-date and date-range pickers at the parent's due date (`useParentIssue`), sends every inline edit through `runUpdate`, which shows one toast via `useIssueUpdateErrorToast` (module/cycle edits too), and passes `accessibleValue` (`sub_work_item.progress_a11y`) to the sub-work item chip. Spreadsheet: `issue-column.tsx` uses the same toast, `columns/due-date-column.tsx` uses the parent cap, `columns/sub-issue-column.tsx` uses `sub_work_item.progress_count`. Calendar: `base-calendar-root.tsx` toast = `getSubtaskRuleError` ?? `detail` ?? the old text; `day-tile.tsx` refuses a drop after a loaded parent's due date. `sub-issues/issues-list/properties.tsx` caps at the parent's due date; `sub-issues/helper.ts` toggles the row loader back in `finally`. One-level rule, one pattern (disabled + tooltip): `canSetParent` in `issue-detail/parent-select.tsx` (aria-disabled + click guard, `text-disabled`, `cursor-not-allowed` wrapper, sr-only reason via `aria-describedby`) and `issue-modal/components/default-properties.tsx` (disabled pill + tooltip); `canAddSubWorkItems` in `sub-issues/quick-action-button.tsx` (disabled trigger + tooltip `sub_work_item.add_disabled`, covers the toolbar in `action-buttons.tsx`, which no longer hides the button). `issue-detail/detail-meta-row.tsx`: due-date `minDate` = the later of the start date and the latest loaded sub-work item due date.
- Our changes (Neuric) 2026-11-15, project create + My Tasks: new `project/member-invite-form.tsx` (`useProjectMemberInviteForm` hook, `ProjectMemberInviteFields`, `ProjectMemberInviteAddMoreButton`). It is the one member + role form, used by `project/send-project-invitation-modal.tsx` (now a thin wrapper) and by the new `project/create/members-step.tsx` (`ProjectCreateMembersStep`). `project/create-project-modal.tsx` steps: create -> MEMBERS (skippable, workspace members only, no guests, creator and lead hidden, role starts as Member) -> features. It stays in apps/web because it reads MobX stores and `dropdowns/member/member-select`. `projects/create/utils.ts` defaults `module_view: true` (Keywords on; backend default unchanged). `workspace/sidebar/sidebar-item.tsx` + `extended-sidebar-item.tsx`: "My Tasks" links to `/profile/<id>/assigned` (main sidebar stays highlighted on every profile tab).
- Our changes (Neuric) 2026-11-15, time tracking: new `issues/issue-detail-widgets/time/` (see its CLAUDE.md), wired into `issue-detail-widgets/action-buttons.tsx` (now an `observer`; toolbar "Log time" icon button), `issue-detail-widget-collapsibles.tsx` and `issue-detail-widget-modals.tsx`, all behind `useWorkLogPermissions` (project flag + ADMIN/MEMBER, not epics). `issue-detail/sidebar-sections.tsx`: "Time logged" row (`IssueWorkLogTotal`, own vs incl. sub-work items in the tooltip) when `is_time_tracking_enabled`. `project/settings/features-list.tsx`: `time_tracking` entry (`is_time_tracking_enabled`, `TimeTrackingOutline`, reuses common.json `time_tracking*` keys). Activity: new `issue-detail/issue-activity/activity/actions/worklog.tsx` (`work_log.activity.*`), `case "worklog"` in `activity-list.tsx`, `worklog` icon in `common/activity/helper.tsx`.
- Our changes (Neuric) 2026-11-16, time tracking review fixes: see `issues/issue-detail-widgets/time/CLAUDE.md`. Also `core/activity.tsx` `worklog` entry (profile/workspace feeds, shared `WorkLogActivityMessage`), `issue-detail/issue-activity/activity/actions/worklog.tsx` uses it, `issue-detail/sidebar-sections.tsx` hides "Time logged" from guests (`canLog`), `settings/project/sidebar/item-icon.tsx` `features_time_tracking` icon, `dropdowns/member/member-select.tsx` `id` prop. B3: `sub-issues/quick-action-button.tsx` clones `customButton` with `disabled` (Base UI lets the render element's own props win, so the toolbar button kept its enabled look). `project/member-invite-form.tsx`: per-row `excludeIds` memoised, required/role strings moved to `project.member_form.*`. `workspace/sidebar/extended-sidebar-item.tsx`: My Tasks active on any tab of the user's own `/profile/<id>/`, not rendered until the user id is loaded.
