# tailwind-config (`@plane/tailwind-config`)

## Purpose

Shared Tailwind CSS v4 entry stylesheet and PostCSS config for every frontend app and UI package. Index: `../CLAUDE.md`.

## Key files

- `index.css` — `@import "tailwindcss"` + `@import "@makeplane/propel/styles"` (design tokens, animations), `@source "../**/*.{ts,tsx}"`, body defaults (`bg-canvas`), custom `@utility` classes (scrollbars, `highlight`, `progress-bar`, ...)
- `postcss.config.js` — `@tailwindcss/postcss` plugin; re-exported by app/package `postcss.config.*`
- `AGENTS.md` — **design-system rules** (canvas / surface / layer, hover/active/selected variants, text and border tokens). Read it before styling anything.

## Rules for this folder

- Token values live in `@makeplane/propel` (npm package, not in this repo). This package only wires them into Tailwind; don't redefine tokens here.
- Use semantic classes (`bg-surface-1`, `bg-layer-1 hover:bg-layer-1-hover`, `text-secondary`, `border-subtle`), not raw colors.
- `bg-canvas` is applied once on `<body>` here; never add it elsewhere.
- Add a global `@utility` only when it is used in several apps; otherwise keep styles in the component.
- No JS config: it is Tailwind v4 CSS-first (`package.json` `main` still names a `tailwind.config.js` that doesn't exist; ignore it).

## Depends on / used by

- Uses: `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `@makeplane/propel`.
- Used by: `apps/web`, `apps/space`, `apps/admin` (via `styles/globals.css` + `postcss.config`), `packages/blocks`, `packages/editor`.

## How to test

No build or tests. Check visually with `pnpm dev`; `pnpm check` covers formatting.

## Our changes (Neuric)

None yet (2026-11-15).
