# apps/web/layouts — page shells and auth wrappers

## Purpose

Wrappers used by route layouts in `app/`. Not the work-item layouts (list/kanban/...); those are in `components/issues/issue-layouts/` and `components/base-layouts/`.
Parent: `../CLAUDE.md`.

## Key files

- `default-layout/index.tsx` — `DefaultLayout`: full-screen container for auth pages (sign-in, sign-up, accounts/\*)
- `auth-layout/workspace-wrapper.tsx` — `WorkspaceAuthWrapper`: checks workspace membership and prefetches workspace data with SWR (members, projects, favorites, states, sidebar + navigation preferences); shows access-denied screen otherwise. Used by `app/(all)/[workspaceSlug]/layout.tsx`
- `auth-layout/project-wrapper.tsx` — `ProjectAuthWrapper`: checks project membership and prefetches project data (details, members, states, labels, estimates, cycles, modules, views, intake). Used by project detail and project settings layouts

## Rules for this folder

- Prefetch with SWR keys from `@plane/constants` (`PROJECT_*`, `WORKSPACE_*`) and call store actions via `@/hooks/store/*`.
- Permission checks use `useUserPermissions` + `EUserPermissions` / `EUserPermissionsLevel`.
- New project-level data that every project page needs (e.g. Neuric phases) gets fetched in `project-wrapper.tsx`.
- UI from `@makeplane/propel` and `@plane/blocks/<subpath>` only.

## Depends on / used by

- Uses: `@/hooks/store`, `@/components/auth-screens`, `@/components/common`, `@plane/constants`, `swr`.
- Used by: layout files in `app/`.

## How to test

`pnpm turbo run check:types --filter=web`; open a workspace/project as a member and as a non-member.

## Our changes (Neuric)

- 2026-11-16, Step 2: `auth-layout/project-wrapper.tsx` prefetches the project's phases (`useProjectPhases`).
