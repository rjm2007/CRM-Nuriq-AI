# types (`@plane/types`)

## Purpose

Shared TypeScript types, interfaces and enums for frontend apps and packages. Mostly the shapes of `apps/api` responses/payloads. Index: `../CLAUDE.md`.

## Key files

- `src/index.ts` — single barrel (re-exports every module; all names share one namespace)
- `src/enums.ts` — shared enums (`EUserPermissions`, `EProjectNetwork`, `EPageAccess`, ...)
- `src/issues/`, `src/issues.ts` — work item (Issue) types: relations, sub-issues, links, attachments, activity
- `src/project/`, `src/cycle/`, `src/module/`, `src/page/`, `src/state.ts`, `src/activity.ts`, `src/publish.ts` (share links / DeployBoard)
- `src/rich-filters/`, `src/view-props.ts`, `src/layout/`, `src/base-layouts/` — filters and layout display types
- `src/utils.ts`, `src/common.ts`, `src/pagination.ts` — generic helper types

## Rules for this folder

- Types and enums only. No runtime logic, no imports from other `@plane/*` packages (this is the bottom layer).
- Field names match the Django serializer output (snake_case), e.g. `project_id`, `created_at`.
- New file/folder -> add `export * from "./<name>";` to `src/index.ts`; avoid name clashes with existing exports.
- When a backend serializer changes (new CRM models: Phase, time tracking...), update the matching type in the same PR. Put new CRM types in their own files (e.g. `src/phase.ts`).
- Naming in this package: `I<Name>` interfaces, `T<Name>` type aliases, `E<Name>` enums.

## Depends on / used by

- Uses: nothing at runtime (React types as peer).
- Used by: every frontend app (`web`, `space`, `admin`, `live`) and `blocks`, `constants`, `editor`, `services`, `shared-state`, `utils`.

## How to test

No unit tests. `pnpm turbo run check --filter=@plane/types`

## Our changes (Neuric)

None yet (2026-11-15).
