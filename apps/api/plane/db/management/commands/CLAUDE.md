# db/management/commands

## Purpose
`manage.py` commands (seeding, maintenance, instance setup).

## Rules
- Commands must be idempotent and safe to re-run.
- Long-running data fixes → prefer a Celery task triggered by a command.

## Our changes (Neuric)
- None yet.
