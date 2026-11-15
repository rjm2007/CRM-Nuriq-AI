# apps/web/store — MobX stores

## Purpose

All client state for the web app. One `RootStore` holds every domain store; stores fetch data through `services/`.
Parent: `../CLAUDE.md`.

## Key files

- `root.store.ts` — `CoreRootStore` (exported as `RootStore`): builds every store with `this`; `resetOnSignOut()` rebuilds them all
- `router.store.ts` — current route params (workspaceSlug, projectId, ...)
- Top-level single-domain stores: `cycle.store.ts`, `module.store.ts`, `label.store.ts`, `state.store.ts`, `project-view.store.ts`, `global-view.store.ts`, `favorite.store.ts`, `dashboard.store.ts`, `analytics.store.ts`, `theme.store.ts`, `instance.store.ts`, `multiple_select.store.ts`, `base-power-k.store.ts`, `base-command-palette.store.ts`, `*_filter.store.ts`
- `issue/` — work items: `root.store.ts`, `issue.store.ts` (normalized map), `helpers/base-issues.store.ts` (shared list logic), one `{issue,filter}.store.ts` pair per context: `project/`, `cycle/`, `module/`, `project-views/`, `workspace/` (global views), `profile/` ("Your work"), `archived/`, `workspace-draft/`; `issue-details/` (activity, comments, links, relations, sub-issues, subscription, attachments, reactions); kanban/calendar/gantt view stores
- `project/` — projects, project filters, publish (DeployBoard) store
- `workspace/` — workspace root, `home.ts`, api tokens, webhooks, links
- `member/` — workspace + project members
- `user/` — account, profile, settings, permissions (`base-permissions.store.ts`)
- `pages/`, `inbox/`, `estimates/`, `notifications/`, `timeline/`, `sticky/`, `editor/` — per-feature stores
- Filter state for work items also comes from `WorkItemFilterStore` in `@plane/shared-state`

## Rules for this folder

- Each store: `I<Name>Store` interface + class using `makeObservable` (observable/action/computed); get other stores via the root passed into the constructor.
- New store: add it to BOTH the constructor and `resetOnSignOut()` in `root.store.ts`, then add a `use<Name>` hook in `hooks/store/`.
- Stores call `services/` classes only; no axios/fetch here; no React imports.
- Keep data normalized by id (maps), update with `runInAction` after awaits, roll back on API failure (existing pattern).
- Stores needed by several apps go in `packages/shared-state`, not here.

## Depends on / used by

- Uses: `@/services/*`, `@plane/types`, `@plane/constants`, `@plane/utils`, `@plane/shared-state`.
- Used by: `hooks/store/*` (via `StoreContext` in `lib/store-context.tsx`), `lib/wrappers/store-wrapper.tsx`.

## How to test

`pnpm turbo run check:types --filter=web`; no store unit tests exist in apps/web yet.

## Our changes (Neuric)

- Our changes (Neuric) 2026-11-15, subtask rules: new `issue/helpers/subtask-progress.helper.ts`, called from `issueUpdate` in `issue/helpers/base-issues.store.ts`: optimistic parent `completed_sub_issues_count` when a child crosses into/out of the completed group (reverted on API error), and a parent re-fetch (see the review-fixes line below) when all siblings are completed/cancelled with at least one completed, so the API's auto-done shows (also refreshes the parent's loaded activity). `issue/issue-details/sub_issues.store.ts` `fetchSubIssues` sets the parent's completed count from `state_distribution`. Pure rules live in `@plane/utils` (`work-item/subtask-rules.ts`).
- Our changes (Neuric) 2026-11-15, subtask rules review fixes: `subtask-progress.helper.ts` now retries the parent re-fetch with backoff (`SUBTASK_ROLLUP_REFETCH_DELAYS_MS` 1.5/3/6 s, max 3 tries), stops once the parent is completed or cancelled, then refreshes its loaded activity after `SUBTASK_ROLLUP_ACTIVITY_REFETCH_DELAY_MS` (1 s). The fresh parent is written to the shared issue map and regrouped only in the current route's list store (teamspace/epic lists skipped) when that list already shows it; `updateIssueList` was added to `IBaseIssuesStore` for this. Skips parents already completed or cancelled; the count fallback counts known cancelled siblings. The optimistic count undo reverses the applied delta instead of restoring an old value. `clearPendingParentRefetches()` runs in `root.store.ts` `resetOnSignOut`. `updateIssueDates` (Gantt) undo writes both dates back (`?? null`).
- Our changes (Neuric) 2026-11-15, time tracking: new `issue/issue-details/worklog.store.ts` (`IssueWorkLogStore`, entries by issue id, `workLogModal` / `workLogDeleteId` UI state), built in `issue/issue-details/root.store.ts` as `workLog` (delegates `fetchWorkLogs/createWorkLog/updateWorkLog/removeWorkLog`, both modals counted in `isAnyModalOpen`; also renamed the shadowing `setLastWidgetAction` param). Writes move the item's `logged_minutes` + `total_logged_minutes` by the delta and the loaded parent's `total_logged_minutes` (only if the API already sent it), then refetch the activity now and after `WORKLOG_ACTIVITY_REFETCH_DELAY_MS` (1.5 s, the API logs it in a background task). No new root store, so `root.store.ts` is unchanged.
- Our changes (Neuric) 2026-11-16, time tracking review fixes: B1 root cause, `issue/issue-details/issue.store.ts` `addIssueToStore` is a field allow-list and dropped `logged_minutes`/`total_logged_minutes`; it now copies them when they are numbers (a fresh detail fetch is the truth). `worklog.store.ts`: totals move only fields that are already numbers, written straight into `issuesMap` (no `updated_at` bump); activity re-fetch is one job per issue with backoff `WORKLOG_ACTIVITY_REFETCH_DELAYS_MS` 1.5/3/6 s, stops once a new `worklog` activity appears, `.catch` on every fetch; `clearPendingActivityRefetches()` runs in `root.store.ts` `resetOnSignOut`; `fetchWorkLogs` merges ids (keeps entries created during the request, drops ones deleted meanwhile or gone on the server); entries sorted by `Date.parse(started_at)`.
