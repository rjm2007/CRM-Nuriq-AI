# hooks (`@plane/hooks`)

## Purpose

Small, generic React hooks shared by several apps and packages. Index: `../CLAUDE.md`.

## Key files

- `src/index.ts` — barrel
- `src/use-dialog-dismissal.tsx` — `useDialogDismissal` (close dialogs on outside click / Escape)
- `src/use-outside-click-detector.tsx` — `useOutsideClickDetector`
- `src/use-local-storage.tsx` — `useLocalStorage`, `getValueFromLocalStorage`, `setValueIntoLocalStorage`
- `src/use-hash-scroll.ts` — `useHashScroll` (scroll to URL hash target)
- `src/use-platform-os.tsx` — `usePlatformOS`

## Rules for this folder

- Generic hooks only: no MobX stores, no API services, no `@plane/*` imports (only `react` is a dependency).
- Hooks that need app stores stay in the app (`apps/web/.../hooks`).
- One hook per file, `use-<name>.ts(x)`, re-exported from `src/index.ts`.

## Depends on / used by

- Uses: `react`.
- Used by: `apps/web`, `apps/admin`, `packages/blocks`, `packages/editor`.

## How to test

No unit tests in this package yet. `pnpm turbo run check --filter=@plane/hooks`

## Our changes (Neuric)

None yet (2026-11-15).
