# apps/web/lib — app infrastructure

## Purpose

Low-level setup for the web app: store context, top-level wrappers, polyfills, progress bar, small browser utilities.
Parent: `../CLAUDE.md`.

## Key files

- `store-context.tsx` — creates the single `RootStore`, `StoreContext`, `StoreProvider` (used in `app/provider.tsx`)
- `wrappers/store-wrapper.tsx` — syncs route params into the router store and the user's theme/sidebar state (mounted in `app/provider.tsx`)
- `wrappers/instance-wrapper.tsx` — fetches instance info (SWR); shows `InstanceNotReady` / `MaintenanceView`
- `wrappers/authentication-wrapper.tsx` — `AuthenticationWrapper`: redirects by auth state/page type (`EPageTypes`)
- `app-rail/` — context + provider for app-rail visibility/collapse
- `b-progress/AppProgressBar.tsx` — top route-change progress bar
- `polyfills/` — installs `requestIdleCallback` polyfill (`idle-task.ts`)
- `local-storage.ts` — `storage.set/get/remove` wrappers
- `stale-asset-error.ts` — detects failed lazy chunk loads after a deploy and reloads

## Rules for this folder

- Keep this for app wiring only; feature logic goes in `components/` / `store/`.
- Only one `RootStore` instance exists; never create another one elsewhere.
- Changes here affect every page — keep them small and check sign-in, onboarding and workspace load after editing.

## Depends on / used by

- Uses: `@/store/root.store`, `@/hooks/store`, `@/helpers/authentication.helper`, `@plane/i18n`.
- Used by: `app/provider.tsx`, `app/root.tsx`, auth pages and `app/(all)/[workspaceSlug]/layout.tsx`.

## How to test

`pnpm turbo run check:types --filter=web`; run `pnpm dev` and sign in/out.

## Our changes (Neuric)

None yet (2026-11-15)
