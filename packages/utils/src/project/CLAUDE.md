# utils/src/project (Neuric)

## Purpose

Neuric project helpers that are not upstream Plane. Kept apart from upstream `../project.ts` so merges stay clean.

## Key files

- `target-date.ts` — `isProjectTargetDateOverdue(date, isArchived)`: overdue when `target_date` <= today (browser local date), same rule as Plane's `shouldHighlightIssueDueDate` (`../work-item/base.ts`). Archived projects are never overdue.

## Rules for this folder

- Pure functions only (see `../../CLAUDE.md`).
- No `index.ts` here: `./project` resolves to upstream `project.ts`, so `../index.ts` exports each file directly (`export * from "./project/target-date"`).

## Depends on / used by

- Uses: `../datetime` (`getDate`), date-fns.
- Used by: `apps/web/components/project/card.tsx`, `apps/web/components/project/form-target-prd.tsx`.

## How to test

No test runner in `@plane/utils`. `pnpm turbo run check:types check:lint --filter=@plane/utils`

## Our changes (Neuric)

- 2026-11-15: folder created with `target-date.ts`.
