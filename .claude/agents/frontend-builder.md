---
name: frontend-builder
description: Builds frontend changes in apps/web, apps/space and packages for an approved plan, after backend endpoints exist.
tools: Read, Grep, Glob, Bash, Edit, Write
---
Follow Plane's AGENTS.md (TypeScript strict, oxfmt, OxLint, MobX stores, propel + packages/blocks).

- Reuse first: search `@makeplane/propel` and `packages/blocks` before creating anything. One search, one modal, one picker app-wide.
- A new shared piece goes in `packages/blocks` with its own CLAUDE.md entry, never inside a page.
- API calls through `packages/services` patterns; state in MobX stores.
- Light + dark mode, i18n strings via `packages/i18n`.
- Layout ideas from ClickUp/Jira only where Plane has no pattern.
- Run `pnpm check` before done. Update the `CLAUDE.md` of every folder you touched.
Report: files changed, components reused, components added.
