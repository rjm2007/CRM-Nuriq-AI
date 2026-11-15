# issue-detail-widgets/time — time tracking widget (IssueWorkLog)

## Purpose

"Time logged" section of the work item detail page and peek: total, entries, log/edit/delete. Same shape as `../links/`. Parent: `../../../CLAUDE.md` (components).

## Key files

- `root.tsx` — `TimeCollapsible`: `EntityDetailWidgetSection` (widget key `"time"`), fetches entries with `useSWR("ISSUE_WORKLOGS_<id>")`, "Log time" action.
- `title.tsx` — `IssueWorkLogTotal`: `formatWorkLogDuration(total_logged_minutes)` with a tooltip "This work item / Including sub-work items". Also used by `issue-detail/sidebar-sections.tsx` (pass a `testId`).
- `content.tsx` — entry list (avatar, date, note, "Logged by" when an admin logged for someone, duration, edit/delete menu) or the `worklog` compact empty state.
- `quick-action-button.tsx` — `IssueWorkLogActionButton` (toolbar `customButton` + widget header).
- `worklog-modal.tsx` — `IssueWorkLogModal`: `DateSelect` (no future days), `DurationInput` (`@plane/blocks/duration-input`), note (`TextAreaField`, 2000 chars), `MemberSelect` with `projectId` for admins only (sends `user` only when it differs).
- `worklog-delete-modal.tsx` — `ConfirmDialog` from `@plane/blocks/dialog`.
- `helper.ts` — `useWorkLogPermissions` (flag + role, mirrors `apps/api/plane/utils/worklog.py`), `useWorkLogOperations` (store calls + toasts; `error_code` -> `work_log.errors.*`).

## Rules for this folder

- Shown only when `project.is_time_tracking_enabled`, the item is a regular work item (not an epic) and the user is project ADMIN/MEMBER. Edit/delete: own entries, or any entry for admins (`canManageWorkLog` in `@plane/utils`).
- State lives in `store/issue/issue-details/worklog.store.ts` (`useIssueDetail().workLog`); modal open state is `workLogModal` / `workLogDeleteId`, scoped by `issueId` so the page and peek don't both open.
- Strings: `work_log.*` in `packages/i18n/src/locales/*/work-item.json`.

## Depends on / used by

- Uses: `@plane/blocks/{entity-detail,empty-state,dialog,duration-input,property-select,toast}`, `@plane/utils` worklog helpers, `dropdowns/member/member-select`.
- Used by: `../action-buttons.tsx`, `../issue-detail-widget-collapsibles.tsx`, `../issue-detail-widget-modals.tsx`, `../../issue-detail/sidebar-sections.tsx`.

## How to test

`pnpm turbo run check:types --filter=web`; manual on http://localhost:3000 (Settings > Features > Enable time tracking, then a work item).

## Our changes (Neuric)

- Our changes (Neuric) 2026-11-15, time tracking: new folder.
