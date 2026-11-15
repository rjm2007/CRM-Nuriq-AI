# apps/web/helpers — web-only helper functions

## Purpose

Small pure helpers and enums used only by the web app. Most shared helpers live in `@plane/utils`.
Parent: `../CLAUDE.md`.

## Key files

- `authentication.helper.tsx` — auth enums (`EPageTypes`, `EAuthModes`, `EAuthSteps`, `EAuthenticationErrorCodes`), `authErrorHandler`, `passwordErrors`
- `cover-image.helper.ts` — static cover images, cover type detection, display URL
- `dashboard.helper.ts` — home dashboard date/duration filters and tab keys
- `issue-filter.helper.ts` — `shouldRenderColumn` for spreadsheet display properties
- `views.helper.ts` — `VIEW_ACCESS_SPECIFIERS` (public/private)
- `graph.helper.ts` — Y-axis tick values for charts
- `emoji.helper.tsx` — `renderEmoji`
- `react-hook-form.helper.ts` — `getNestedError`

## Rules for this folder

- Pure functions/constants only; no stores, no API calls.
- Check `@plane/utils` and `@plane/constants` first; put anything useful to other apps there instead.
- User-facing strings should be i18n keys (`packages/i18n`), not hardcoded text.

## Depends on / used by

- Uses: `@plane/types`, `@plane/constants`, `@plane/utils`.
- Used by: `components/`, `app/`, `lib/wrappers/`.

## How to test

`pnpm turbo run check:types --filter=web`.

## Our changes (Neuric)

None yet (2026-11-15)
