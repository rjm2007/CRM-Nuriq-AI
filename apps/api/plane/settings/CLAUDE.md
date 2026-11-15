# settings

## Key files

- `common.py` (shared), `local.py`, `production.py`, `test.py`, `redis.py`, `storage.py` (S3/MinIO), `openapi.py`

## Rules

- Every setting comes from env vars with safe defaults; add each new var to `.env.example`.
- No secrets in code. Production values come from AWS Secrets Manager (docs/CLOUD.md).
- New AI settings (e.g. encryption key for provider credentials) go in `common.py` read from env.

## Our changes (Neuric)

- 2026-11-15: `common.py` `CELERY_IMPORTS` adds `plane.bgtasks.subtask_rollup_task`.
