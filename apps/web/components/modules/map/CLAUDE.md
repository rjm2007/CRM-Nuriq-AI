# components/modules/map (keyword map)

## Purpose

The `map` layout of the Modules (Keywords) page: keywords as boxes in phase swimlanes, `ModuleRelation` edges between them (Step 2). The canvas is `@plane/blocks/graph-canvas`, loaded with `React.lazy`.

## Key files

- `modules-map-view.tsx` — `ModulesMapView({ moduleIds })` (observer). Phases via `useProjectPhases`, relations via SWR `PROJECT_MODULE_RELATIONS_SWR_KEY` + `useModuleRelation()` store. Node click toggles `?peekModule=` like the list item. Connect / "Link to" -> `createRelation`, label -> `updateRelation`, delete -> `deleteRelation`; write errors -> `setToast`. Shows a spinner until phases and relations are loaded (so saved positions apply on first layout); a relations load failure shows an inline error + Retry (SWR `mutate`); a 403 (guest without feature access) means no edges and read-only. Nodes/edges memo on keys built in render from phases' `module_ids`, keyword name/progress and relation labels (store objects change in place). Read-only unless project ADMIN or MEMBER.
- `positions-storage.ts` — node positions in localStorage, key `neuric_keyword_map_positions:<userId>:<projectId>`; read/write wrapped in try/catch, broken values dropped.

## Rules for this folder

- Rendered by `../modules-list-view.tsx` through `React.lazy` + `Suspense` (spinner) when `displayFilters.layout === "map"` with the filtered keyword ids (filters apply to the map).
- Never import `@plane/blocks/graph-canvas` statically (types only); keep it lazy.
- Strings: `keyword_map.*` i18n keys; also `common.link` (Link to picker), `common.retry`, `module.label` (lane count).

## Depends on / used by

- Uses: `@/hooks/store/use-phase`, `@/hooks/use-project-phases`, `@/hooks/store/use-module`, `@plane/blocks/{graph-canvas,toast,spinner}`.
- Used by: `apps/web/components/modules/modules-list-view.tsx`.

## Our changes (Neuric)

- 2026-11-16, Step 2: new folder.
- 2026-11-16, review fixes: loader until data, inline Retry, 403 = no relations, in-place store change tracking, lazy view.
