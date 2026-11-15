/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/** One box on the canvas. `laneId` null (or an id not in `lanes`) puts it in the fallback lane. */
export type GraphCanvasNode = {
  id: string;
  label: string;
  /** Small second line under the label (dates, counts...). */
  meta?: string;
  laneId: string | null;
};

/** A vertical swimlane. Lanes are drawn left to right in array order; the fallback lane comes last. */
export type GraphCanvasLane = {
  id: string;
  title: string;
};

/** A directed edge `source -> target` with an optional text label. */
export type GraphCanvasEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

/**
 * A node the user moved, relative to the top-left corner of its lane. The position is only used
 * while the node is still in `laneId`, so a node that changes lane falls back to the auto layout.
 */
export type GraphCanvasPosition = {
  laneId: string;
  x: number;
  y: number;
};

export type GraphCanvasPositions = Record<string, GraphCanvasPosition>;

/** Every visible string; the canvas has no copy of its own so callers translate them. */
export type GraphCanvasLabels = {
  /** Accessible name of the canvas region. */
  canvas: string;
  /** Title of the lane for nodes without a lane. */
  noLane: string;
  /** Button shown on a selected edge without a label. */
  addEdgeLabel: string;
  /** Accessible name of the label button ("Edit label"). */
  editEdgeLabel: string;
  /** Accessible name of the label text field. */
  edgeLabelInput: string;
  /** Accessible name of the delete-edge button. */
  deleteEdge: string;
  /**
   * Accessible name of the "link to" picker on a selected node (keyboard way to add an edge).
   * The picker is shown only when this and `onConnect` are set.
   */
  linkTo?: string;
  /** Screen-reader text for a lane's node count, e.g. `(3) => "3 keywords"`. Defaults to the number. */
  laneCount?: (count: number) => string;
  zoomIn?: string;
  zoomOut?: string;
  fitView?: string;
  controls?: string;
};

export type GraphCanvasProps = {
  nodes: GraphCanvasNode[];
  lanes: GraphCanvasLane[];
  edges: GraphCanvasEdge[];
  labels: GraphCanvasLabels;
  /** Saved positions (see `GraphCanvasPosition`). Missing nodes use the auto layout. */
  positions?: GraphCanvasPositions;
  /** Called after a drag with the full, merged positions map. */
  onPositionsChange?: (positions: GraphCanvasPositions) => void;
  /** User dragged from `source`'s handle to `target`. Self-links and duplicates are blocked first. */
  onConnect?: (source: string, target: string) => void;
  onEdgeLabelChange?: (edgeId: string, label: string) => void;
  onEdgeDelete?: (edgeId: string) => void;
  onNodeClick?: (nodeId: string) => void;
  /** No connecting, label editing or deleting. Nodes can still be moved (positions are personal). */
  readOnly?: boolean;
  className?: string;
};
