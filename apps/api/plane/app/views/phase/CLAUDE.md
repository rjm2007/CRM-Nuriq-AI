# app/views/phase — keyword map (Step 2)

## Purpose

Web-app endpoints for project phases, keyword-to-phase assignment and keyword relations (map edges). "Keyword" = Plane `Module`.

## Key files

- `base.py` — `PhaseViewSet` (list/retrieve/create/partial_update/destroy), `PhaseModuleEndpoint` (POST assign, DELETE remove)
- `relation.py` — `ModuleRelationViewSet` (list/create/partial_update/destroy)
- Routes: `app/urls/phase.py`. Serializers: `app/serializers/phase.py`.

## Rules for this folder

- Views stay thin: validate with the serializer, then call `plane/utils/keyword_map.py`. Never write Phase/PhaseModule/ModuleRelation rows here; the service owns rules, webhooks and the `phase` activity fan-out.
- Lookups go through `get_live_project` / `get_project_phase` / `get_project_relation` (URL workspace + project scoped, archived projects 404).
- 400 bodies: `keyword_map_errors(serializer.errors)` or the service's `{field: [msg], error_code}`.
- Permissions (docs/DECISIONS.md "Step 2 choices"): phase create/edit/delete/reorder = project ADMIN; assign/remove keywords and relation writes = ADMIN, MEMBER; reads = ADMIN, MEMBER, GUEST, but GUEST gets 403 unless the project has `guest_view_all_features` (`keyword_map_hidden_from_guest`, checked in every read). Use `allow_permission`.
- Response shapes must match `apps/web/services/phase.service.ts` / `packages/types/src/phase/phase.ts` (lists are plain arrays; assign returns the phase).

## Depends on / used by

- Uses: `plane/utils/keyword_map.py`, `bgtasks/phase_activity.py` (via the service)
- Used by: `apps/web/services/phase.service.ts`. Public twin: `api/views/phase.py`.

## How to test

`docker exec crm-api-1 python -m pytest plane/tests/contract/app/test_phase_app.py -q`

## Our changes (Neuric)

- 2026-11-16: folder created (Step 2).
