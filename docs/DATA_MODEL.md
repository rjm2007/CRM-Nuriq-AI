# Data model — new tables (PROPOSAL)

Status: draft. The researcher agent must verify each item against Plane's code and OSS references before any migration is written. Reuse Plane models wherever possible.

## Reused from Plane (no new tables)
Project, Issue (+ `parent` for subtasks), IssueRelation (dependencies), State (custom statuses), Label, Cycle (sprints), Module (keywords), Page + FileAsset (docs), IssueActivity, IssueComment + IssueMention, DeployBoard (share links), Estimate.

## New (all extend ProjectBaseModel unless noted)
**Phase** — name, description, sequence, start_date, target_date.
**PhaseModule** — phase ↔ module (keyword) link, sequence.
**ModuleLink** — source_module, target_module, label (for the Archify-style map).
**IssueWorkLog** — issue, user, started_at, duration_minutes, note. Parent total = sum over issue + its subtasks (query, not stored).
**TestSuite** — name, module (keyword, optional).
**TestCase** — suite, title, steps, expected_result, linked issue (optional), sequence.
**TestRun** — suite, name, started_by, shared via DeployBoard.
**TestResult** — run, case, status (pass/fail/blocked/skipped), note, tested_by_name (client, no login).
**ClientFeedback** — deploy_board, entity type + id, name, email (optional), comment. Rate-limited, spam-checked.
**Transcript** — title, text or file asset, meeting_date, uploaded_by.
**AIJob** — kind (keywords / tasks_from_transcript / …), status, input ref, output JSON, provider, model, error, tokens. Runs in Celery.
**AIProposal** — job, proposed items JSON, status (pending/accepted/rejected), reviewed_by. Nothing is created until a human accepts.
**AIProviderConnection** (WorkspaceBaseModel) — provider (openai), auth_type (api_key / chatgpt_signin), encrypted credential, created_by.
**Artifact** — reuse FileAsset/Page + `source` (manual / mcp / claude_code / codex) and `created_via_token`.

## Rules to implement
- Subtasks one level deep (validate in serializer + DB check where possible).
- Subtask due date ≤ parent due date.
- All subtasks in a "completed" state-group → parent moves to project's default completed state (Celery task off the activity pipeline). Manual moves still allowed.
- Every new model logs to activity.
- Verify: does Project already store a target/completion date and PRD link? If not, add fields to Project via migration.
