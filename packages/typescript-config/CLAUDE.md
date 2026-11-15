# typescript-config (`@plane/typescript-config`)

## Purpose

Shared `tsconfig` presets that every TS app/package `extends`. Index: `../CLAUDE.md`.

## Key files

- `base.json` — strict base (also extended directly by `apps/live`): `strict`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`, `noImplicitReturns`, `verbatimModuleSyntax`, `moduleResolution: bundler`, `noEmit`
- `react-library.json` — base + `jsx: react-jsx`, DOM libs (`blocks`, `editor`, `hooks`, `i18n`, `services`, `shared-state`, `utils`)
- `node-library.json` — base + Node types (`constants`, `decorators`, `logger`, `types`)
- `react-router.json` — base + ES2022/DOM for React Router apps (`apps/web`, `apps/space`, `apps/admin`)
- `nextjs.json` — Next.js preset (no current consumer found)

## Rules for this folder

- Changes here affect the whole monorepo: run `pnpm check:types` at the root after any edit.
- Don't loosen strictness to silence errors; fix the code instead.
- Per-package overrides (paths aliases, decorators flags) go in that package's own `tsconfig.json`.
- `package.json` `files` omits `react-router.json`; harmless for workspace use, but add it if you touch that list.

## Depends on / used by

- Uses: nothing.
- Used by: every TS package and app (`devDependencies: "@plane/typescript-config": "workspace:*"`).

## How to test

`pnpm check:types` (repo root)

## Our changes (Neuric)

None yet (2026-11-15).
