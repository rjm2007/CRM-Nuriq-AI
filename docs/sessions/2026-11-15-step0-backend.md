# Step 0 backend — 2026-11-15

## Goal
Map Plane's backend, write folder CLAUDE.md files, find gaps.

## Done
- 28 CLAUDE.md files under apps/api (see each folder).
- docs/GAP_LIST.md.

## Decisions
- Use `app/permissions` (69 imports) not `utils/permissions` (3).
- Our new models go in new files in db/models to keep upstream merges clean.
- Project gets `target_date` + `prd_page`.

## Not done
- Frontend CLAUDE.md files and frontend gap check.
- Nothing run in Docker yet.

## Next step (paste into Claude Code)
/start — then: "Verify docs/GAP_LIST.md against the running app, then do Step 1 item 1 (Project target_date + prd_page) with the backend-builder agent."
