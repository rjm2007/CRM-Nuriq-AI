# logger (`@plane/logger`)

## Purpose

Winston-based JSON logger and Express request-logging middleware for Node services. Index: `../CLAUDE.md`. Usage: `README.md`.

## Key files

- `src/config.ts` — `loggerConfig` (level from `LOG_LEVEL`, default `info`; timestamped JSON to console) and `logger`
- `src/middleware.ts` — `loggerMiddleware` (express-winston, logs method/url/status/time)
- `src/index.ts` — barrel

## Rules for this folder

- Node-only. Not for browser apps (they use `console`/Sentry).
- Logs go to stdout as JSON only (12-factor, see `docs/CLOUD.md`); don't add file transports.
- Never log secrets, tokens or full request bodies.
- `LOG_LEVEL` is listed in root `turbo.json` `globalEnv`; keep it that way if config changes.
- `check:lint` runs with `--max-warnings=0`.

## Depends on / used by

- Uses: `winston`, `express-winston`.
- Used by: `apps/live`.

## How to test

No unit tests in this package. `pnpm turbo run check --filter=@plane/logger`

## Our changes (Neuric)

None yet (2026-11-15).
