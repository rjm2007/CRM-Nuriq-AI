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
- None yet.
