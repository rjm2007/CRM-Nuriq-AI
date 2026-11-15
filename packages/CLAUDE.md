# packages

## Purpose

Shared TypeScript workspace packages (`@plane/*`) used by the frontend apps (`apps/web`, `apps/space`, `apps/admin`) and the Node collab server (`apps/live`). Nothing here is used by `apps/api` (Python).

## Key files

| Package              | Name                       | What it is for                                                                                                             | Used by                           |
| -------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `blocks/`            | `@plane/blocks`            | Composite UI built on propel (toast, select, dialog, empty-state, charts...). Subpath imports only. See `blocks/CLAUDE.md` | web, space, admin, editor         |
| `codemods/`          | `@plane/codemods`          | jscodeshift transforms run over the repo. See `codemods/CLAUDE.md`                                                         | dev tool only                     |
| `constants/`         | `@plane/constants`         | Shared constants, env-based URLs (`API_BASE_URL`...)                                                                       | most apps/packages                |
| `decorators/`        | `@plane/decorators`        | Express controller/route/WebSocket decorators                                                                              | live                              |
| `editor/`            | `@plane/editor`            | Tiptap rich-text/document editor (+ `/lib`, `/server`)                                                                     | web, space, live                  |
| `hooks/`             | `@plane/hooks`             | Small shared React hooks                                                                                                   | web, admin, blocks, editor        |
| `i18n/`              | `@plane/i18n`              | i18next setup + locale JSON (en is source of truth)                                                                        | web, space, admin, blocks         |
| `logger/`            | `@plane/logger`            | Winston logger + Express request middleware                                                                                | live                              |
| `services/`          | `@plane/services`          | Axios `APIService` base + shared API service classes                                                                       | web, space, admin, live           |
| `shared-state/`      | `@plane/shared-state`      | MobX stores shared across apps (filters, user, workspace)                                                                  | web                               |
| `tailwind-config/`   | `@plane/tailwind-config`   | Tailwind v4 CSS entry + PostCSS config; design-token rules in `tailwind-config/AGENTS.md`                                  | web, space, admin, blocks, editor |
| `types/`             | `@plane/types`             | Shared TS types/enums mirroring API payloads                                                                               | almost everything                 |
| `typescript-config/` | `@plane/typescript-config` | Base tsconfig presets                                                                                                      | every TS package/app              |
| `utils/`             | `@plane/utils`             | Pure helpers (`cn`, dates, filters, permissions, editor/markdown)                                                          | most apps/packages                |

Each package has its own `CLAUDE.md`.

## Rules for this folder

- `@makeplane/propel` (UI primitives, design tokens) is an **npm package pulled via `catalog:`**, not a folder here. Do not look for or fork it in `packages/`.
- New shared UI pieces go in `blocks/` (root rule 3), never inside an app page.
- Internal deps use `workspace:*`; external deps use `catalog:` (versions in root `pnpm-workspace.yaml`).
- Most packages build with tsdown to `dist/`; apps import `dist`, so turbo runs `^build` before `dev`, `test`, `check:types`. If an import "is missing", rebuild the package.
- Every new `.ts`/`.tsx` file needs the `COPYRIGHT.txt` header.
- Dependency order (from package.json): `types` <- `constants` <- `utils` <- `services`, `shared-state`; `blocks` uses `types/constants/utils/hooks/i18n`; `editor` uses `blocks`. `hooks`, `i18n`, `logger`, `decorators` have no `@plane/*` runtime deps. Never add a reverse dependency (e.g. `types` importing `utils`).
- Don't add a new package unless no existing one fits; record why in `docs/DECISIONS.md`.

## Depends on / used by

- Uses: npm `catalog:` deps, `@makeplane/propel`.
- Used by: `apps/web`, `apps/space`, `apps/admin`, `apps/live`.

## How to test

- All checks: `pnpm check` (repo root)
- One package: `pnpm turbo run check test --filter=@plane/<name>` (turbo builds deps first)

## Our changes (Neuric)

None yet (2026-11-15).
