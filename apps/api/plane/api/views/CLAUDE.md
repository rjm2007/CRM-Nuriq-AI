# api/views — public API handlers

## Rules

- Same scoping and permission rules as app/views.
- Return Plane's standard error format; paginate lists.
- Our planned additions: phases, worklogs, tests, transcripts/AI jobs, artifacts (for MCP).

## Our changes (Neuric)

- 2026-11-15 (time tracking): `worklog.py` — the same rules as the app worklog views; role check via `utils.worklog.can_access_time_tracking` (no `allow_permission` here). OpenAPI tag "Work Item Time Entries". `issue.py` `IssueDetailAPIEndpoint.get` annotates both totals for project ADMIN/MEMBER only (`can_view_time`); the activity list/detail drop `worklog` rows for guests. A workspace admin with project role GUEST is a guest here.
- 2026-11-16 (Step 2): `phase.py` — v1 phases (reads: admin/member, guests only with `guest_view_all_features` via `keyword_map_hidden_from_guest`, else 403; writes: `ProjectAdminPermission`, like states), phase keywords and module relations (`ProjectEntityPermission`: writes ADMIN/MEMBER). Thin: same `utils/keyword_map.py` calls as the app views. Lists paginated. OpenAPI tags "Phases", "Keyword Relations".
