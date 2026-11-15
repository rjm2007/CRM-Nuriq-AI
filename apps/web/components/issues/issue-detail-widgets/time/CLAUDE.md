# issue-detail-widgets/time — time tracking widget (IssueWorkLog)

## Purpose

"Time logged" section of the work item detail page and peek: total, entries, log/edit/delete. Same shape as `../links/`. Parent: `../../../CLAUDE.md` (components).

## Key files

- `root.tsx` — `TimeCollapsible`: `EntityDetailWidgetSection` (widget key `"time"`), fetches entries with `useSWR("ISSUE_WORKLOGS_<id>")` (skipped for archived items), Skeleton while loading, inline error + Retry when the fetch fails, "Log time" action.
- `title.tsx` — `IssueWorkLogTotal`: `formatWorkLogDuration(total_logged_minutes)` with a tooltip "This work item / Including sub-work items"; the trigger is a `<button>` with sr-only text as its name. Also used by `issue-detail/sidebar-sections.tsx` (pass a `testId`).
- `content.tsx` — entry list (avatar, date via `renderFormattedDate(new Date(started_at))` = same local day as the modal, note, "Logged by" when an admin logged for someone, duration, edit/delete menu) or the `worklog` compact empty state.
- `quick-action-button.tsx` — `IssueWorkLogActionButton` (toolbar `customButton` + widget header).
- `worklog-modal.tsx` — `IssueWorkLogModal`: `DateSelect` (no future days), `DurationInput` (`@plane/blocks/duration-input`), note (`TextAreaField`, 2000 chars), `MemberSelect` for admins only, offering project ADMIN/MEMBER by raw project role (sends `user` only when it differs). Labels use `htmlFor` (DateSelect/MemberSelect `id`); member trigger named via `tooltip.heading`. Cancel disabled while saving. Closes (not "Log time") when the edited entry disappears.
- `worklog-delete-modal.tsx` — `ConfirmDialog` from `@plane/blocks/dialog`.
- `helper.ts` — `useRawProjectRole` (`workspaceProjectsPermissions`, no workspace-admin elevation), `useWorkLogPermissions(slug, projectId, serviceType, issueId?)` (flag + raw role + not archived, mirrors `apps/api/plane/utils/worklog.py`), `useWorkLogOperations` (store calls + toasts). Error order: `error_code` -> 403 `forbidden` (edit/delete) -> 404 `not_found` + reload entries -> 400 first field message -> generic.
- `activity-message.tsx` — `WorkLogActivityMessage` (shared by the Activity tab row and `core/activity.tsx` feeds); "for <name>" parsed from the created row's comment (`bgtasks/worklog_activity.py`).

## Rules for this folder

- Shown only when `project.is_time_tracking_enabled`, the item is a regular, non-archived work item (not an epic) and the user's raw project role is ADMIN/MEMBER (a workspace admin who is a project guest gets nothing, like the API). Edit/delete: own entries, or any entry for admins (`canManageWorkLog` in `@plane/utils`).
- State lives in `store/issue/issue-details/worklog.store.ts` (`useIssueDetail().workLog`); modal open state is `workLogModal` / `workLogDeleteId`, scoped by `issueId` so the page and peek don't both open.
- Strings: `work_log.*` in `packages/i18n/src/locales/*/work-item.json`.

## Depends on / used by

- Uses: `@plane/blocks/{entity-detail,empty-state,dialog,duration-input,property-select,toast}`, `@plane/utils` worklog helpers, `dropdowns/member/member-select`.
- Used by: `../action-buttons.tsx`, `../issue-detail-widget-collapsibles.tsx`, `../issue-detail-widget-modals.tsx`, `../../issue-detail/sidebar-sections.tsx`.

## How to test

`pnpm turbo run check:types --filter=web`; manual on http://localhost:3000 (project Settings > Features > Time tracking, `/<ws>/settings/projects/<id>/features/time-tracking/`, then a work item).

## Our changes (Neuric)

- Our changes (Neuric) 2026-11-15, time tracking: new folder.
- Our changes (Neuric) 2026-11-16, review fixes: raw-role permissions, archived guard, loading/error states, error toast mapping by status, modal a11y + member filter, shared activity message, accessible total badge.
