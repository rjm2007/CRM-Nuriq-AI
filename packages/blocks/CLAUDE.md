# blocks (`@plane/blocks`)

## Purpose

Composite, Plane-specific React components built on `@makeplane/propel` primitives. This is where **every new shared UI piece goes** (root CLAUDE.md rule 3). Index: `../CLAUDE.md`.

## Key files

- `src/<component>/index.ts` — public barrel for one subpath (e.g. `src/toast/index.ts` -> `@plane/blocks/toast`)
- `src/charts/<chart>/index.ts` — chart subpaths (`@plane/blocks/charts/bar-chart`...)
- `src/types/`, `src/utils/`, `src/icons/` — shared types, helpers (`dot-separator`, `placement`), Plane icons
- `src/__tests__/` — cross-component DOM tests
- `package.json` `exports` — the list of public subpaths (no `"."` root export)
- `tsdown.config.ts` — entries `src/*/index.ts`, `src/charts/*/index.ts`, `src/emoji-icon-picker/data.ts`
- `vitest.config.ts` — two projects: `unit` (`*.test.ts`, node) and `dom` (`*.test.tsx`, jsdom)
- `vitest.setup.dom.ts` — jsdom stubs (ResizeObserver, IntersectionObserver, layout/scroll, pointer capture)

## Rules for this folder

- Import only via subpaths: `import { setToast } from "@plane/blocks/toast"`. There is no root import.
- Build on propel: `@makeplane/propel/components/*`, `/elements/*`, `/icons`. Don't re-implement a primitive propel already has.
- Strings come from `useTranslation()` in `@plane/i18n`; class merging via `cn` from `@plane/utils`.
- Styling: semantic tokens only (`bg-surface-1`, `bg-layer-1`, `text-primary`...), see `../tailwind-config/AGENTS.md`.
- No app stores, routers or API calls here. Pass data and callbacks in as props.
- Inside the package use relative imports, not `@plane/blocks/...`.

## Adding a component

1. Check propel and the existing subpaths first; extend an existing folder if it fits.
2. Create `src/<name>/` with kebab-case files, each starting with the `COPYRIGHT.txt` header.
3. Add `src/<name>/index.ts` exporting components **and** their prop types (`export type { IFoo }`).
4. Add `"./<name>": "./dist/<name>/index.js"` to `exports` in `package.json` (keep alphabetical). tsdown picks up the entry automatically via `src/*/index.ts`; a deeper entry (like `charts/*`) needs a new `entry` glob in `tsdown.config.ts` too.
5. New npm deps: add to `dependencies` with `catalog:` (add the version to root `pnpm-workspace.yaml` catalog only if new). Ask before installing.
6. Tests next to the code: `<name>.test.tsx` (DOM, Testing Library + user-event) or `<name>.test.ts` (pure logic). Cover a11y roles and keyboard behavior like existing tests.
7. Run `pnpm --filter=@plane/blocks build` so apps see `dist/`, then use the subpath in the app.

## Depends on / used by

- Uses: `@makeplane/propel`, `@base-ui/react`, `@plane/{constants,hooks,i18n,types,utils}`, recharts, `@tanstack/react-virtual`, pragmatic-drag-and-drop.
- Used by: `apps/web`, `apps/space`, `apps/admin`, `packages/editor`.

## How to test

- `pnpm turbo run test --filter=@plane/blocks` (builds deps first; runs `vitest run --project=unit --project=dom`)
- `pnpm turbo run check --filter=@plane/blocks`

## Our changes (Neuric)

- 2026-11-15: `PageSelect` (`src/property-select/page-select.tsx` + `page-select.test.tsx`), exported from `@plane/blocks/property-select` with `PageOption`/`PageSelectProps`. Sync-mode single picker: pages come in via `options`, `value` is a page id, `onChange(id | null)`, `missingLabel` when the id is not in `options`.
