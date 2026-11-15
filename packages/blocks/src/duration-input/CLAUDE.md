# blocks/src/duration-input (`@plane/blocks/duration-input`)

## Purpose

`DurationInput`: one text field for a duration in minutes ("1h 30m", "1:30", "90m", "1.5h", "90"). Used by the time tracking (IssueWorkLog) modal; reuse it for any other duration field. Parent: `../../CLAUDE.md`.

## Key files

- `duration-input.tsx` — controlled field on propel `InputField`. Parses on blur and on Enter (Enter is `preventDefault`ed so the form submits on the next Enter, with the parsed value), normalises the text to "1h 30m", shows `invalidMessage` inline with `aria-invalid` when the text can't be parsed or is outside `min..max` (default 1..1440) and emits `undefined`. `error` = outside error (e.g. required), the parse error wins. Props: `id`, `value`, `onChange`, `label` or `aria-label`, `placeholder`, `hint`, `required`, `disabled`, `size`, `className`.
- `duration-input.test.tsx` — DOM tests (label/id, blur + Enter commit, inline error, range, parent value sync).
- `index.ts` — exports `DurationInput` + `DurationInputProps`.

## Rules for this folder

- Parsing/formatting lives in `@plane/utils` (`parseWorkLogDuration`, `formatWorkLogDuration`, `WORKLOG_MIN/MAX_MINUTES`); don't duplicate it here. Unit tests for those are in `../__tests__/worklog.test.ts`.
- No i18n inside: the caller passes translated `label`, `hint`, `invalidMessage`.
- No `autoFocus` (jsx-a11y `no-autofocus`); dialogs focus their first field.
- To reset the text from outside, remount with a `key` (the modal keys its form by entry id).

## Depends on / used by

- Uses: `@makeplane/propel/components/input-field`, `@plane/utils`.
- Used by: `apps/web/components/issues/issue-detail-widgets/time/worklog-modal.tsx`.

## How to test

`pnpm turbo run test --filter=@plane/blocks` (or `npx vitest run src/duration-input` in `packages/blocks`).

## Our changes (Neuric)

- Our changes (Neuric) 2026-11-15, time tracking: new folder, `DurationInput` + tests, `"./duration-input"` export in `package.json`.
