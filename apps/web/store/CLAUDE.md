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

None yet (2026-11-15)
