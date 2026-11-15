# apps/web — main web app

## Purpose

Plane's main client app (workspaces, projects, work items, cycles, modules, pages, analytics).
React Router v7 in SPA mode (`ssr: false`) + Vite, MobX for state. Dev server on :3000.

## Key files

- `app/` — routes, root shell, providers (see `app/CLAUDE.md`)
- `components/` — feature UI, ~1400 files (see `components/CLAUDE.md`)
- `store/` — MobX stores, one `RootStore` (see `store/CLAUDE.md`)
- `services/` — axios API clients (see `services/CLAUDE.md`)
- `hooks/` — store hooks + UI hooks (see `hooks/CLAUDE.md`)
- `helpers/`, `lib/`, `layouts/` — see their own CLAUDE.md
- `react-router.config.ts` — `appDirectory: "app"`, `ssr: false`
- `vite.config.ts` — aliases `next/link`, `next/navigation`, `next/script` to `app/compat/next/*`; exposes only `VITE_*` env vars as `process.env`
- `tsconfig.json` — `@/*` maps to this folder (`@/components/...`, `@/store/...`)
- `.env.example` — `VITE_API_BASE_URL`, `VITE_WEB/ADMIN/SPACE/LIVE_BASE_URL` (+ base paths)
- `Dockerfile.web` (prod), `Dockerfile.dev`; `caddy/`, `public/`, `styles/` hold no app logic

## Rules for this folder

- Primitives come from `@makeplane/propel` (`@makeplane/propel/components/*`, `elements/*`, `icons`).
- Composite components come from `@plane/blocks` via subpath imports only (e.g. `@plane/blocks/toast`, `@plane/blocks/empty-state`). New shared pieces go in `packages/blocks`, never inside a page.
- MobX stores live in `store/`; stores shared across apps go in `packages/shared-state`.
- Components never call axios directly: component -> hook -> store -> `services/` -> API.
- UI strings: `useTranslation()` from `@plane/i18n`; keys live in `packages/i18n/src/locales/<lang>/*.json` (`en` is the source).
- Internal deps `workspace:*`, external deps `catalog:` (root AGENTS.md).
- New `.ts`/`.tsx` files need the `COPYRIGHT.txt` header.
- Only `VITE_*` env vars reach the browser; never put secrets in them.

## Depends on / used by

- Uses: `@plane/{blocks,constants,editor,hooks,i18n,services,shared-state,types,utils}`, `@makeplane/propel`, API at `apps/api` (`plane/app` URLs).
- Used by: end users; links out to `apps/space` (public pages) and `apps/admin`.

## How to test

- No unit-test runner is set up in apps/web (no vitest/jest, no test files).
- `pnpm turbo run check:types --filter=web` (runs `react-router typegen` + `tsc`)
- `pnpm turbo run check:lint --filter=web`, `pnpm turbo run check:format --filter=web`
- Manual: `pnpm dev`, open http://localhost:3000

## Where things live (quick map)

- "Your work" / My Tasks: route `app/(all)/[workspaceSlug]/(projects)/profile/[userId]/`
  (tabs summary/assigned/created/subscribed/activity), UI `components/profile/`, store `store/issue/profile/`.
- Analytics: route `.../(projects)/analytics/[tabId]/` (tabs `overview`, `work-items`), UI `components/analytics/`, store `store/analytics.store.ts`.
- Work item layouts (list/kanban/calendar/spreadsheet/gantt): `components/issues/issue-layouts/`.
- Workspace home: `.../(projects)/page.tsx` + `components/home/`.

## Our changes (Neuric)

- Our changes (Neuric) 2026-11-15, subtask rules: frontend for one-level sub-work items, due date capped by the parent, `done/total` progress on cards, parent auto-done refresh and toasts for the API's `error_code`s. See `components/`, `store/`, `hooks/` CLAUDE.md.
