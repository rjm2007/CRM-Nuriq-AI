# Step 0 finish + Step 1 Projects & Tasks — 2026-11-16

## Goal

Finish Step 0 (frontend CLAUDE.md + gap list) and build all of Step 1, working autonomously (self-approved plans), each feature tested with Playwright and live API calls.

## Done (files changed)

Branch `feat/subtask-rules` (14 commits on top of `main`, pushed to origin 2026-11-16; PR opened manually since `gh` isn't installed). Branches `chore/step0-frontend-docs` and `feat/project-target-date-prd` point at earlier commits of the same chain.

| Commit                 | What                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 540386de87             | CLAUDE.md for apps/web (9) + packages (15); frontend gap list in `docs/GAP_LIST.md`                                            |
| 8a850da554, a314081cbe | `Project.target_date` + `Project.prd_page` (migration 0126), PRD validation, stale-link cleanup in page views                  |
| bbe25670cb, 900f905c1b | UI: target date (create pill, settings, card + overdue), shared `PageSelect` in `@plane/blocks`                                |
| ff3ab52005, 55a5fd6484 | Subtask rules: one level, due ≤ parent, `completed_sub_issues_count`, parent auto-done Celery task                             |
| bb38fb6a7c, 2ac512e66b | Subtask UI: done/total on cards, date caps in all views, disabled actions, error toasts, auto-done refresh                     |
| bda868fdf0             | Members step on project create, "Your work" → "My Tasks" (opens Assigned), Modules on by default                               |
| af984de315, 5186ece655 | Time tracking backend: `IssueWorkLog` (migration 0127), app + v1 endpoints, totals incl. subtasks, activity rows, guest hiding |
| e73303d2dd, 92748a0666 | Time tracking UI: "Log time" widget, sidebar total, settings page `features/time-tracking`, `DurationInput` in `@plane/blocks` |

Uncommitted (this handoff): this note, `docs/progress/CURRENT.md`, `apps/web/components/project/CLAUDE.md`, `.../features/time-tracking/CLAUDE.md`.

Test results at end of chat:

- Playwright: time tracking 14/14, subtasks 8/8, project date+PRD 8/8, members/My Tasks/modules 10/10.
- Live API E2E 17/17. Backend: unit 737 pass; worklog 152; subtask 85; PRD 50.
- Test scripts live in the session scratchpad (not in repo).

## Decisions (and why)

All in `docs/DECISIONS.md`. Highlights:

- Phase is derived from keyword (Module), no `Issue.phase`.
- Cancelled subtasks are ignored for auto-done (needs ≥1 completed).
- Project overdue = target_date ≤ today (same as Plane work items).
- Time tracking: flag gates writes only; admins may log for members; archived subtasks count; **guests see no time data**.
- Commits carry no Claude/AI attribution (user request).

## Not done / in progress (files touched)

- Nothing in progress. Branch pushed; PR to be opened by the user.
- Test data in local DB: admin `admin@neuric.test` (password given to user in chat), member `member@neuric.test` ("Mia"), several "E2E/UI/Time/Subtasks/Members ..." projects.
- Playwright Chromium + `playwright@1.56.1` installed in the session scratchpad (Google Chrome install needs sudo — user would have to run `npx playwright install chrome` themselves).

## Blockers / questions for the team

- 4–15 magic-link auth tests fail in the dev container because SMTP isn't configured (unrelated; should pass in `docker-compose-test.yml`).
- `apps/web` has no unit-test runner; frontend helpers are tested from `packages/blocks`. Decide if we add vitest to apps/web / packages/utils (needs install).
- Non-English i18n strings are machine translations — native review needed.
- Plane dev mode logs a hydration warning on every page (pre-existing, not ours).
- Still open from planning: AGPL check for client share links; "Sign in with ChatGPT" eligibility.

## Next step (exact prompt the next chat can paste)

```
/start
Step 1 is done on branch feat/subtask-rules (pushed; PR to main opened manually by the user).
Then start Step 2 (keywords + map + phases): run the researcher agent for Phase/PhaseModule/ModuleLink per docs/DATA_MODEL.md and docs/ROADMAP.md, and the Archify map idea (check its license).
Test login: admin@neuric.test (ask me for the password).
```
