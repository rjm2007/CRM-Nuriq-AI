# shared-state (`@plane/shared-state`)

## Purpose

MobX stores and helpers meant to be shared across apps (AGENTS.md: "stores shared across apps go in `packages/shared-state`"). Today it mainly holds the rich-filter engine used by work-item filters. Index: `../CLAUDE.md`.

## Key files

- `src/store/rich-filters/` — generic filter tree: `filter.ts` (`IFilterInstance`), `config.ts`, `config-manager.ts`, `adapter.ts`, `filter-helpers.ts`
- `src/store/work-item-filters/` — `WorkItemFilterStore` / `IWorkItemFilterStore`, `IWorkItemFilterInstance`, adapter for work items
- `src/utils/` — `rich-filter.helper.ts`, `work-item-filters.helper.ts`
- `src/store/user.store.ts`, `src/store/workspace.store.ts` — small `UserStore` / `WorkspaceStore` classes, **not** exported from `src/store/index.ts` (unused)
- `src/index.ts` — barrel (`store`, `utils`)

## Rules for this folder

- Only stores used by 2+ apps belong here; app-only stores stay in `apps/<app>/store/`.
- MobX style: `makeObservable` with explicit annotations, like the existing stores.
- No API calls or React components; pass data in. Types come from `@plane/types`.
- New CRM filter properties (Phase, Keyword...) plug in through the work-item filter config/adapter, not a new filter system.
- `check:lint` runs with `--max-warnings=0`.

## Depends on / used by

- Uses: `mobx`, `mobx-utils`, `zod`, `lodash-es`, `uuid`, `@plane/{constants,types,utils}`.
- Used by: `apps/web` (only consumer today).

## How to test

No unit tests in this package yet. `pnpm turbo run check --filter=@plane/shared-state`

## Our changes (Neuric)

None yet (2026-11-15).
