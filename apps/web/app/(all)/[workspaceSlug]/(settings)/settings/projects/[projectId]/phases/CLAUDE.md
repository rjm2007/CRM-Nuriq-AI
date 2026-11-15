# phases — project settings page (Neuric, Step 2)

## Purpose

Project settings page for phases: list, create, edit, delete, reorder, and keywords per phase.

## Key files

- `page.tsx` — any project member may open it (`NotAuthorizedView` otherwise); renders `PhaseSettingsRoot` (`components/phases/settings/root.tsx`), which hides edit controls from non-admins
- `header.tsx` — breadcrumbs (copy of `states/header.tsx`)

## Rules for this folder

- Route registered in `apps/web/app/routes/extended.ts`, not `core.ts`.
- Sidebar entry: `PROJECT_SETTINGS.phases` (WORK_STRUCTURE group) in `packages/constants/src/settings/project.ts`; icon in `components/settings/project/sidebar/item-icon.tsx`.

## Depends on / used by

- Uses: `components/phases`, i18n `project_settings.phases.*`.
- Used by: project settings sidebar -> Work structure -> Phases.

## How to test

Open `/<ws>/settings/projects/<projectId>/phases/` as project admin (full controls) and as member (keywords only).

## Our changes (Neuric)

- 2026-11-16: created.
