# space — public (no-login) API

## Purpose

Serves published entities through DeployBoard anchors (apps/space frontend). **Base for our client share links.**

## Map

- `views/` (project, issue, cycle, module, label, state, intake, asset, meta), `serializer/`, `urls/`, `utils/`

## Rules

- Every query must be scoped by the DeployBoard `anchor` and respect its flags (comments/reactions/votes enabled, is_disabled).
- Read-only by default; any write (our ClientFeedback, TestResult) must be rate-limited and validated.
- Never expose internal fields (emails, member lists, private comments).

## Our changes (Neuric)

- 2026-11-15 (time tracking): share links never return time totals (see `views/CLAUDE.md`).
