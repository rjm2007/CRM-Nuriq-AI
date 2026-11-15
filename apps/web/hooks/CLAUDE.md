# apps/web/hooks — React hooks

## Purpose

Hooks for reading MobX stores and for shared UI behaviour in the web app.
Parent: `../CLAUDE.md`.

## Key files

- `store/` — one hook per store: `useContext(StoreContext)` then return a slice (e.g. `use-cycle.ts` -> `context.cycle`). Includes `use-issues.ts`, `use-issue-detail.ts`, `use-project.ts`, `use-workspace.ts`, `use-member.ts`, `use-analytics.ts`, `use-home.ts`, `user/`, `estimates/`, `notifications/`, `work-item-filters/`, `workspace-draft/`; `index.ts` re-exports
- `context/use-issue-modal.tsx` — issue modal context
- `editor/`, `pages/`, `oauth/`, `rich-filters/`, `work-item-filters/` — feature hook groups
- Issue/layout: `use-issues-actions.tsx`, `use-issue-layout-store.ts`, `use-group-dragndrop.ts`, `use-issue-properties.tsx`, `use-workspace-issue-properties.ts`, `use-issue-peek-overview-redirection.tsx`, `use-timeline-chart.ts`
- Generic UI: `use-debounce`, `use-local-storage`, `use-keypress`, `use-window-size`, `use-intersection-observer`, `use-online-status`, `use-timezone*`, `use-query-params`, `use-app-router`, `use-platform-os`
- `use-navigation-preferences.ts`, `use-workspace-paths.ts` — sidebar/navigation helpers

## Rules for this folder

- Components read stores only through `hooks/store/*`; new store => new `use<Name>` hook here that throws if used outside `StoreProvider`.
- Hooks that are not web-specific belong in `packages/hooks` (`@plane/hooks`).
- No direct API calls from hooks except through services/stores.
- `.tsx` only when the hook returns JSX or uses context providers; otherwise `.ts`.

## Depends on / used by

- Uses: `@/lib/store-context`, `@/store/*` types, `@/services`, `@plane/*`.
- Used by: `components/`, `app/`, `layouts/`, `lib/wrappers/`.

## How to test

`pnpm turbo run check:types --filter=web`.

## Our changes (Neuric)

None yet (2026-11-15)
