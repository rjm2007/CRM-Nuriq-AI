# Gap list — Plane CE vs our needs (backend)

Checked against makeplane/plane source on 2026-11-15. Paths are under `apps/api/plane/`.

| Need | Plane has | Gap / action |
|---|---|---|
| Project name, description | `Project.name`, `description_html` | — |
| Project admin + employees | `ProjectMember` + roles (`app/permissions/base.py` ROLE) | Map Admin = project admin role |
| Project completion date | **No** target date on Project | Add `Project.target_date` (nullable) |
| PRD on project | **No** field | Add `Project.prd_page` FK → Page (nullable); uploads via FileAsset |
| Tasks / subtasks | `Issue`, `Issue.parent`, `app/views/issue/sub_issue.py` | Add one-level rule + subtask due date ≤ parent (serializer) |
| Subtask progress "3/5" | Partial (sub-issue list) | Add counts to issue detail serializer |
| Parent auto-done | **No** | New Celery task `subtask_rollup_task.py`, hooked after state activity |
| Custom statuses per project | `State` + `StateGroup` | — |
| Priority, labels, assignees | Yes | — |
| Dependencies | `IssueRelation` (blocked_by etc.) | — |
| Comments + @mentions | `IssueComment`, `IssueMention` | — |
| Activity tab (task + subtask) | `IssueActivity` + `bgtasks/issue_activities_task.py` | Subtasks are issues → already covered. Extend mapper for new models |
| Time tracking | Only flag `Project.is_time_tracking_enabled`; **no worklog model** in CE | New `IssueWorkLog` model + endpoints + roll-up |
| Kanban / List / Calendar | Frontend layouts | — |
| Sprints | `Cycle` | Custom length already free-form (start/end dates) |
| Keywords | `Module` (name, description, dates, lead, members) | Use Module; add `ModuleLink` for the map |
| Phases | **No** | New `Phase` + `PhaseModule` |
| Docs | `Page`, `FileAsset` | Add artifact `source` field |
| Client share link | `DeployBoard` (anchor, comments/reactions flags) + `space/` | Add test results + client feedback, throttled |
| Test cases | **No** | New TestSuite/TestCase/TestRun/TestResult |
| AI agent | **No** (CE) | New Transcript, AIJob, AIProposal, AIProviderConnection + Celery |
| Public API for MCP | `api/` at `/api/v1/`, X-Api-Key | Add endpoints for every new model |
| My Tasks | Frontend "Your work" (verify in apps/web) | Frontend check next |
| Dashboard / reports | `analytics`, `app/views/analytic` | Verify in frontend |

## Order for Step 1 backend
1. Project fields (target_date, prd_page) — small migration.
2. Subtask rules + progress counts — serializer only, no migration.
3. Parent auto-done task.
4. IssueWorkLog model + API + activity.
