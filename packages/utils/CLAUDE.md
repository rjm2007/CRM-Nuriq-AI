# utils (`@plane/utils`)

## Purpose

Pure helper functions shared by frontend apps and packages: class merging, dates, strings, filters, permissions, theme colors, editor/markdown conversion. Index: `../CLAUDE.md`.

## Key files

- `src/index.ts` — single barrel (every module re-exported; one shared namespace)
- `src/common.ts` — `cn` (clsx + tailwind-merge) and other small helpers
- `src/datetime.ts`, `src/calendar.ts` — date-fns based formatting/ranges
- `src/string.ts`, `src/array.ts`, `src/math.ts`, `src/url.ts`, `src/validation.ts`
- `src/permission/` — role/permission checks (`role.ts`)
- `src/work-item/`, `src/work-item-filters/`, `src/rich-filters/`, `src/filter.ts` — work-item and filter helpers
- `src/cycle.ts`, `src/module.ts`, `src/project.ts`, `src/page.ts`, `src/workspace.ts`, `src/estimates.ts`, ... — per-domain helpers
- `src/editor/` — editor helpers + `markdown-parser/` (HTML <-> Markdown via unified/rehype/remark)
- `src/theme/` — palette generation, color conversion, theme application; `theme-legacy.ts` only exports `resolveGeneralTheme`

## Rules for this folder

- Pure, stateless functions. No MobX stores, no API calls, no React components.
- Imports allowed: `@plane/types`, `@plane/constants`, npm deps. Never import `blocks`, `services`, `shared-state` or apps.
- Sanitize user HTML with the existing `sanitize-html` based helpers; don't add another sanitizer.
- New file -> add to `src/index.ts`; check names don't collide with existing exports.
- New CRM helpers (Phase, time tracking...) go in their own file so upstream merges stay clean.
- `check:lint` allows up to 38 warnings (upstream debt); don't add new ones.

## Depends on / used by

- Uses: `@plane/{constants,types}`, `@makeplane/propel`, date-fns, lodash-es, clsx, tailwind-merge, chroma-js, unified/rehype/remark, sanitize-html, uuid.
- Used by: `apps/web`, `apps/space`, `apps/admin`, `apps/live`, `blocks`, `editor`, `shared-state`.

## How to test

No unit tests in this package yet (no `test` script). `pnpm turbo run check --filter=@plane/utils`

## Our changes (Neuric)

- 2026-11-15: `src/project/target-date.ts` (`isProjectTargetDateOverdue`, see `src/project/CLAUDE.md`), exported from `src/index.ts` as `./project/target-date` (folder sits next to upstream `project.ts`).
- Our changes (Neuric) 2026-11-15, subtask rules: `src/work-item/subtask-rules.ts`: `getSubtaskRuleError(err, t)` (maps `error_code`, list or string, to `sub_work_item.errors.<code>`; falls back to the first field message; `undefined` when no `error_code`), `getSubtaskRuleErrorCode`, `getCompletedSubIssuesCountDelta`, `adjustCompletedSubIssuesCount`, `isSubtaskRollupReady`, `formatSubIssuesProgress`. Tests live in `packages/blocks/src/__tests__/subtask-rules.test.ts` (this package has no runner).
- Our changes (Neuric) 2026-11-15, subtask rules review fixes: `work-item/subtask-rules.ts` adds `canAddSubWorkItems(issue)`, `canSetParent(issue, loadedSubIds)`, `isSubtaskRollupReadyFromCounts(total, completed, cancelled)`, `applyCompletedSubIssuesCountDelta` (returns the delta that landed, for undo); `getSubtaskRuleError` formats `{date}` with `renderFormattedDate`.
