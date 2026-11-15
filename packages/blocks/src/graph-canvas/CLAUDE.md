# blocks/src/graph-canvas (`@plane/blocks/graph-canvas`)

## Purpose

`GraphCanvas`: generic directed-graph canvas on React Flow (`@xyflow/react`, MIT) with ordered vertical swimlanes. Props-driven (no stores, router or API). First user: the keyword map (`apps/web/components/modules/map`). Parent: `../../CLAUDE.md`.

## Key files

- `graph-canvas.tsx` — `GraphCanvas` (named + default export). Imports `@xyflow/react/dist/style.css` (kept external by tsdown; the app's Vite resolves it inside the lazy chunk). `GRAPH_CANVAS_THEME_STYLE` maps React Flow `--xy-*` vars to propel tokens (`--background-color-*`, `--border-color-*`, `--text-color-*`; light + dark). Lanes are parent nodes; items are children with `extent: "parent"`. Del/Backspace deletes selected edges (not in read-only). Enter on a focused node calls `onNodeClick` (section `onKeyDown`). A node being dragged keeps its live position when inputs re-sync.
- `graph-canvas.types.ts` — `GraphCanvasNode/Lane/Edge/Position(s)/Labels/Props`.
- `layout.ts` — pure layout (no dagre/elk): `computeGraphCanvasLayout` (lanes in order, fallback "no lane" lane last, stack slots, saved positions only while the node stays in the saved lane), `clampToLane`, `isAllowedGraphConnection` (no self-link, no duplicate same-direction edge).
- `item-node.tsx` — node card, one tab stop (React Flow's node wrapper, `ariaLabel` = label + meta); body click -> `onNodeClick`. A selected editable node shows a "Link to" picker (`Select` from `../select`, `labels.linkTo`) -> `onConnect`; linked targets are disabled. Handles: `in` (left), `out` (right), hidden `in-right` used only to route same-lane edges.
- `lane-node.tsx` — lane column with title + count (sr-only text from `labels.laneCount`).
- `labeled-edge.tsx` — bezier edge with arrow and editable label (first click on a label selects the edge, next click / "Add label" edits; Enter or blur saves once via `finishedRef`, Escape cancels), delete button on a selected edge, `getSameSidePath` for same-lane edges. Labels get z-index 1001 to sit above nodes.
- `context.ts` — callbacks/labels for the custom renderers (`onEdgeSelect`, `onLink`, `getLinkOptions`).
- Tests: `layout.test.ts`, `labeled-edge.test.ts` (unit), `graph-canvas.test.tsx` (DOM; stubs a measuring `ResizeObserver` + `DOMMatrixReadOnly` so edges render in jsdom).

## Rules for this folder

- No i18n inside: callers pass every string in `labels`.
- Typography: semantic tokens only (`text-body-xs-medium`, `text-caption-sm-regular`), no `text-13`/`text-11`.
- Import the subpath only through `React.lazy` in apps (it pulls React Flow + its CSS).
- `positions` are lane-relative; persisting them is the caller's job (`onPositionsChange` gets the merged map).
- In jsdom use `fireEvent.click` on nodes: user-event's mousedown has no `view`, which d3-drag needs.

## Depends on / used by

- Uses: `@xyflow/react`, `@makeplane/propel` (`IconButton`, `Icon`, `CloseOutline`, `LinkOutline`), `../select` (`Select`), `@plane/utils` (`cn`).
- Used by: `apps/web/components/modules/map/modules-map-view.tsx`.

## How to test

`pnpm exec vitest run --project=unit --project=dom src/graph-canvas` in `packages/blocks`.

## Our changes (Neuric)

- 2026-11-16, Step 2 keyword map: new folder, `"./graph-canvas"` export in `package.json`.
- 2026-11-16, review fixes: real propel CSS vars (+ test), keyboard "Link to" picker, single tab stop per node, label click selects edge first (fixes delete), no double save on Enter, no snap-back mid-drag, semantic typography, lane count for screen readers.
