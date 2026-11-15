# db — data layer

## Purpose

All Django models (`models/`), migrations (`migrations/`), management commands.

## Rules

- Only place for schema changes. One migration per change, named clearly.
- Migrations must be backward-compatible (add nullable → backfill → enforce).
- Never edit an existing migration that is already merged.
- Commit `apps/api/migrations_lockfile.txt` with every migration.

## Our planned additions

See `docs/DATA_MODEL.md` (Phase, PhaseModule, ModuleLink, IssueWorkLog, TestSuite/Case/Run/Result, ClientFeedback, Transcript, AIJob, AIProposal, AIProviderConnection).

## Our changes (Neuric)

- 2026-11-15 (time tracking): migration `0127_issue_worklog` (CreateModel IssueWorkLog, first op `SET LOCAL lock_timeout = '5s'` like 0126). Purge needs no `deletion_task.hard_delete` line: its final loop already purges every model with `deleted_at`.
- 2026-11-16 (Step 2): migration `0128_phase_phasemodule` (Phase, PhaseModule, ModuleRelation; `SET LOCAL lock_timeout`).
