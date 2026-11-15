# editor (`@plane/editor`)

## Purpose

Plane's Tiptap-based editors (rich text, lite text for comments, document, collaborative document) plus the framework-free pieces `apps/live` needs on the server. Index: `../CLAUDE.md`. Full API: `Readme.md`.

## Key files

- `src/index.ts` — main entry: editors, helpers, constants, extension lists, types
- `src/lib.ts` — `@plane/editor/lib`: core extensions without props, collab events, Yjs utils (no React)
- `src/server.ts` — `@plane/editor/server`: `lib` + HTML/JSON/Yjs conversion for `apps/live`
- `src/components/editors/` — `rich-text/`, `lite-text/`, `document/`, editor wrapper/container
- `src/components/menus/`, `src/components/links/` — bubble/slash menus, link UI
- `src/extensions/` — Tiptap extensions (mentions, custom-image, table, callout, slash-commands, work-item-embed, ...)
- `src/helpers/` — editor commands, asset handling, `document-codecs.ts`, `yjs-utils.ts`
- `src/hooks/`, `src/contexts/`, `src/plugins/`, `src/types/`, `src/constants/`
- `src/styles/` — CSS exported as `@plane/editor/styles`

## Rules for this folder

- Inside the package import with the `@/` alias (maps to `src/`).
- `lib.ts` / `server.ts` must stay free of React/DOM code; they run in Node (`apps/live`).
- Uploads, mentions, etc. come in through props (`fileHandler`, `mentionHandler`); no direct API calls here.
- UI pieces come from `@makeplane/propel` and `@plane/blocks`.
- Changing document schema/extensions affects stored pages and live collab: check `apps/live` and existing content.
- `check:lint` allows up to 416 warnings (upstream debt); don't add new ones.

## Depends on / used by

- Uses: Tiptap, Hocuspocus/Yjs, floating-ui, `@makeplane/propel`, `@plane/{blocks,constants,hooks,types,utils}`.
- Used by: `apps/web`, `apps/space`, `apps/live`.

## How to test

- `pnpm turbo run test --filter=@plane/editor` (vitest, happy-dom, `src/**/*.test.ts`)
- `pnpm turbo run check --filter=@plane/editor` (build is `tsc && tsdown`)

## Our changes (Neuric)

None yet (2026-11-15).
