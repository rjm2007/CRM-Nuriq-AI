# apps/web/components/project — project UI

## Purpose

Project cards, create modal steps, settings form, members, publish (share link) and feature toggles.
Parent: `../CLAUDE.md`.

## Key files

- `create-project-modal.tsx` — steps: create (`../projects/create/*`) → members (`create/members-step.tsx`) → features (`project-feature-update.tsx`)
- `create/` — create-flow pieces (`common-attributes.tsx`, `members-step.tsx`)
- `form.tsx` — project settings "General" form; `form-target-prd.tsx` — target date + PRD page fields
- `card.tsx`, `card-list.tsx`, `root.tsx` — projects list
- `member-invite-form.tsx` — shared member + role rows (used by `send-project-invitation-modal.tsx` and the members step)
- `member-list*.tsx`, `confirm-project-member-remove.tsx` — settings members page
- `settings/features-list.tsx` — feature toggles shown in the create flow's features step
- `publish-project/` — DeployBoard publish modal (client share links)

## Rules for this folder

- Pickers/selects come from `@plane/blocks/property-select` (`DateSelect`, `PageSelect`, `MemberSelect`); don't add new shared pickers here.
- Read stores via `@/hooks/store/*`; wrap store readers in `observer`.
- Overdue rule: `isProjectTargetDateOverdue` from `@plane/utils` (due today counts).
- Project feature toggles for existing projects live as settings pages under `app/.../settings/projects/[projectId]/features/*`, not here.

## Depends on / used by

- Uses: project, member and page stores; `@plane/blocks`, `@makeplane/propel`, `@plane/i18n`.
- Used by: projects list page, project settings pages, create-project entry points.

## How to test

`pnpm turbo run check:types --filter=web`; manual/Playwright: create a project (date pill, members step), settings → General (target date, PRD), projects list card.

## Our changes (Neuric)

- 2026-11-15: `form-target-prd.tsx` (target date, PRD page picker, Open PRD), `form.tsx` payload, `card.tsx` target date + overdue.
- 2026-11-15: members step (`create/members-step.tsx`), shared `member-invite-form.tsx` (extracted from the invite modal; behaviour kept, already-picked members hidden).
- 2026-11-15: `settings/features-list.tsx` adds the time tracking toggle (create flow).
