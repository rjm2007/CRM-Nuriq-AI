# space/views — public handlers

## Our planned additions

- Test run view + pass/fail submission (TestResult) for clients.
- ClientFeedback submission.
  Both: throttled, input-validated, anchor-scoped. Add contract tests mirroring `tests/contract/app/test_deploy_board_*`.

## Our changes (Neuric)

- 2026-11-15 (time tracking): `issue.py` calls `issue_queryset_grouper(..., with_time_totals=False)` so `total_logged_minutes` is not exposed to clients.
