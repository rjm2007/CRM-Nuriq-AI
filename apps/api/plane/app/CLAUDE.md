# app — web-app API (`/api/`)

## Purpose
Endpoints used by apps/web. Session auth with CSRF.

## Map
- `views/` — viewsets per domain. `serializers/` — DRF serializers. `urls/` — routes per domain.
- `permissions/` — role checks (ProjectEntityPermission, ProjectMemberPermission, ProjectAdminPermission, Workspace*). **Use these** (not `utils/permissions`, which is legacy-duplicate; 69 vs 3 imports).

## Rules
- Every new endpoint: viewset in `views/<domain>/`, serializer in `serializers/<domain>.py`, route in `urls/<domain>.py`, permission class set.
- Trigger activity logging via `issue_activity.delay(...)` after changes.
- Add contract tests in `tests/contract/app/`.

## Our changes (Neuric)
- None yet.
