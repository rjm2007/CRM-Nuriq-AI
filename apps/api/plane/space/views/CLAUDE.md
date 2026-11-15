# space/views — public handlers

## Our planned additions

- Test run view + pass/fail submission (TestResult) for clients.
- ClientFeedback submission.
  Both: throttled, input-validated, anchor-scoped. Add contract tests mirroring `tests/contract/app/test_deploy_board_*`.

## Our changes (Neuric)

- 2026-11-15 (time tracking): no code change here. The space grouper (`space/utils/grouper.py`) never annotates time totals, so share links don't expose them; don't pass app-grouper arguments (`with_time_totals`) to it (that caused a 500). Test: `tests/contract/app/test_worklog_space_app.py`.
