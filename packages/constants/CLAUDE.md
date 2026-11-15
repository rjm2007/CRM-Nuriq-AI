# constants (`@plane/constants`)

## Purpose

Shared constant values (enums-as-objects, option lists, limits, URLs, SWR/fetch keys) for all frontend apps and packages. Index: `../CLAUDE.md`.

## Key files

- `src/index.ts` — single barrel; every module is re-exported here
- `src/endpoints.ts` — `API_BASE_URL`, `WEB_BASE_URL`, `SPACE_BASE_URL`, `ADMIN_BASE_URL`, `LIVE_BASE_URL` (+ `_PATH`) read from `process.env.VITE_*`
- `src/issue/`, `src/analytics/`, `src/auth/`, `src/rich-filters/`, `src/settings/` — grouped constants for those areas
- One file per domain otherwise: `cycle.ts`, `module.ts`, `state.ts`, `project.ts`, `workspace.ts`, `page.ts`, `views.ts`, `fetch-keys.ts`, `swr.ts`, ...

## Rules for this folder

- Values only. No React components, no API calls, no app state.
- Only `@plane/types` may be imported (it is the sole runtime dep).
- New file -> add `export * from "./<file>";` to `src/index.ts`. Watch for name collisions across files (all share one namespace).
- Env-driven values use `process.env.VITE_*` with a `""` default, and the var must be listed in root `turbo.json` `globalEnv`. No secrets here (it ships to the browser).
- New CRM constants (Phase, time tracking...) get their own file, e.g. `src/phase.ts`, so upstream merges stay clean.

## Depends on / used by

- Uses: `@plane/types`.
- Used by: web, space, admin, blocks, editor, services, shared-state, utils.

## How to test

No unit tests in this package. `pnpm turbo run check --filter=@plane/constants`

## Our changes (Neuric)

- 2026-11-15: `PROJECT_CREATE_TAB_INDICES` gains `"target_date"` after `"lead"` (`src/tab-indices.ts`).
