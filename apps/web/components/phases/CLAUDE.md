# components/phases — project phases UI (Neuric, Step 2)

## Purpose

Phases split a project into ordered stages; each keyword (Plane `Module`) is in at most one phase. A work
item's phases are derived from its keywords (no `Issue.phase` field). Data: `store/phase.store.ts`
(`usePhase`), loaded with `hooks/use-project-phases.ts`.

## Key files

- `settings/root.tsx` — `PhaseSettingsRoot`: list, "Add phase", empty state (`EmptyStateCompact`), drag reorder (`getPhaseDropSequence` midpoint -> `movePhase`), toasts
- `settings/phase-item.tsx` — one phase row: drag (pragmatic-drag-and-drop, copied from `project-states/state-item.tsx`), edit/delete menu + `ConfirmDialog`, phase dates, keyword date span
- `settings/phase-form.tsx` — inline create/edit form: name, description, `DateRangeSelect` (start/target)
- `settings/phase-keywords.tsx` — keyword chips (remove), visible "dates outside this phase" warnings, add picker (`dropdowns/module/module-select` in add mode, value always `[]`)
- `settings/helper.ts` — `formatPhaseDateRange`
- `phase-select.tsx` — `ProjectPhaseSelect` (controlled, keyword form) and `ModulePhaseSelect` (bound to one keyword, keyword sidebar/peek), both wrap the `PhaseSelect` block
- `phase-badges.tsx` — `ModulePhaseBadge` (keyword list row) and `IssuePhaseList` (work item sidebar, read-only, all phases)
- `activity-message.tsx` — text of `phase` activity rows (Activity tab + profile/workspace feeds)

## Rules for this folder

- Edit/delete/reorder phases: project ADMIN only. Add/remove keywords and set a keyword's phase: ADMIN + MEMBER. Guests read.
- Date warnings never block saving (the API accepts them too).
- Strings: `phase.*` (module.json) and `project_settings.phases.*` (project-settings.json).
- Pure logic goes in `@plane/utils` `src/phase.ts` (tested in `packages/blocks/src/__tests__/phase.test.ts`).

## Depends on / used by

- Uses: `usePhase`, `useModule`, `useUserPermissions`, `@plane/blocks/{property-select,dialog,empty-state,toast,common,skeleton}`, propel.
- Used by: settings route `settings/projects/<id>/phases`, `modules/form.tsx` + `modal.tsx`, `modules/analytics-sidebar/root.tsx`, `modules/module-list-item-action.tsx`, `issues/issue-detail/sidebar-sections.tsx`, `issue-activity/activity/actions/phase.tsx`, `core/activity.tsx`.

## How to test

`pnpm turbo run check:types --filter=web`; open `/<ws>/settings/projects/<id>/phases/` as admin and as member/guest.

## Our changes (Neuric)

- 2026-11-16: created (Step 2).
- 2026-11-16, review fixes: store rollback is per keyword + re-fetch; `PhaseBadge` (one badge, `aria-label` "Phase: X") used by `ModulePhaseBadge`/`IssuePhaseList`; `IssuePhaseRow` (work item sidebar row, hidden on a phases 403); keyword chips are propel `Badge` + remove button disabled while its request runs; add-keyword picker shows each keyword's current phase (`getOptionDescription`) and an info toast `project_settings.phases.toast.keyword_moved` when a keyword leaves another phase; row menu "Move up"/"Move down" (same `getPhaseDropSequence` logic as drag); load error = `EmptyStateCompact` + Retry (`fetchPhases`); profile/workspace feeds use `phase.activity.*_feed` (`{item}` = work item link, split on a token in `activity-message.tsx`). Guests on a 403 see an empty list, no error.
