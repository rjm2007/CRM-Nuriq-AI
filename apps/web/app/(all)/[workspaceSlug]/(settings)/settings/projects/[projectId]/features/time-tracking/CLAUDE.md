# features/time-tracking — project settings page (Neuric)

## Purpose

Lets a project admin turn time tracking (`Project.is_time_tracking_enabled`) on or off for an existing project.

## Key files

- `page.tsx` — admin check, `ProjectSettingsFeatureControlItem` toggle, `NotAuthorizedView` for others (copied from `features/intake`)
- `header.tsx` — breadcrumbs/header

## Rules for this folder

- The route is registered in `apps/web/app/routes/extended.ts` (Neuric extension point), not in `core.ts`, to keep upstream merges clean.
- Sidebar entry: `features_time_tracking` in `packages/constants/src/settings/project.ts`.

## Depends on / used by

- Uses: project store `updateProject`, i18n `project_settings.features.time_tracking.*`.
- Used by: project settings sidebar → Features → Time tracking.

## How to test

Open `/<ws>/settings/projects/<projectId>/features/time-tracking/` as project admin, flip the switch; the work item "Log time" button appears/disappears.

## Our changes (Neuric)

- 2026-11-16: created.
