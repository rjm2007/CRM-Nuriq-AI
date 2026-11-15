# services (`@plane/services`)

## Purpose

Shared axios-based API client classes for the Django API (`apps/api`), used by more than one app. Index: `../CLAUDE.md`.

## Key files

- `src/api.service.ts` — abstract `APIService` (axios, `withCredentials`, trailing-slash normalization). Not re-exported from the barrel; services import it relatively.
- `src/index.ts` — barrel of the domain folders below
- `src/<domain>/` — `ai`, `auth`, `cycle`, `dashboard`, `developer` (api tokens, webhooks), `file`, `instance`, `intake`, `issue`, `label`, `module`, `project`, `state`, `user`, `workspace`
- `sites-*.service.ts` — public, anchor-based endpoints used by `apps/space` (client share links)
- `src/helpers/url.ts` — `normalizeAPIRequestURL`
- `src/file/helper.ts` — upload payload / metadata helpers
- `src/live.service.ts`, `src/indexedDB.service.ts` — abstract bases, not in the barrel

## Rules for this folder

- One class per file, `<name>.service.ts`, `extends APIService`, constructor `(BASE_URL?: string)` defaulting to `API_BASE_URL` from `@plane/constants`.
- Request/response types come from `@plane/types`; no MobX, no React, no UI.
- Add new files to the folder `index.ts`; add new folders to `src/index.ts`.
- Only put a service here if several apps need it. `apps/web` has its own `apps/web/services/` (with its own `APIService`) and most web-only calls live there.
- Each new CRM endpoint also needs a line in `docs/API.md` (root rule 4).

## Depends on / used by

- Uses: `axios`, `file-type`, `@plane/constants`, `@plane/types`.
- Used by: `apps/web`, `apps/space`, `apps/admin`, `apps/live`.

## How to test

- `pnpm turbo run test --filter=@plane/services` (vitest; tests sit next to code, e.g. `src/helpers/url.test.ts`)
- `pnpm turbo run check --filter=@plane/services`

## Our changes (Neuric)

None yet (2026-11-15).
