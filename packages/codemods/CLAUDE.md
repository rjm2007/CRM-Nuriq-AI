# codemods (`@plane/codemods`)

## Purpose

jscodeshift transforms for repo-wide refactors. A dev tool only; no app imports it. Index: `../CLAUDE.md`.

## Key files

- `function-declaration.ts` — transform for `.tsx` files (converts component arrow functions to function declarations)
- `remove-directives.ts` — transform for `.ts`/`.tsx` files (strips directives such as `"use client"`)
- `tests/*.spec.ts` — vitest specs for both transforms
- `instructions.md` — how to run them + jscodeshift API cheat sheet
- `package.json` — scripts with the target globs (`apps/*/{app,ce,core,ee,helpers,src}`, `packages/*/src`)

## Rules for this folder

- Codemods rewrite many files at once. Run on a clean branch, review the diff, then `pnpm fix` and `pnpm check`.
- Every new transform gets a spec in `tests/` and a script in `package.json`.
- Not built or published; no `dist/`.

## Depends on / used by

- Uses: `jscodeshift`, `@hypermod/utils`, `ast-types`.
- Used by: developers, by hand.

## How to test

`pnpm --filter=@plane/codemods test`
Run a transform: `pnpm --filter=@plane/codemods function-declaration` (or `remove-directives`).

## Our changes (Neuric)

None yet (2026-11-15).
