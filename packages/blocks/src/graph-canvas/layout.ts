/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Swimlane layout for the graph canvas, computed in code (no dagre/elk): one column per lane, in
// order, nodes stacked top to bottom inside their lane. Positions of nodes are relative to the lane.

import type { GraphCanvasLane, GraphCanvasNode, GraphCanvasPositions } from "./graph-canvas.types";

/** Id of the lane that collects nodes without a (known) lane. */
export const GRAPH_CANVAS_NO_LANE_ID = "__graph_canvas_no_lane__";

export const GRAPH_CANVAS_LAYOUT = {
  laneWidth: 264,
  laneGap: 24,
  laneHeader: 48,
  lanePadding: 16,
  nodeWidth: 232,
  nodeHeight: 56,
  nodeGap: 16,
  minLaneHeight: 320,
} as const;

export type GraphCanvasLaidOutLane = {
  id: string;
  title: string;
  /** True for the fallback "no lane" column. */
  isFallback: boolean;
  x: number;
  width: number;
  height: number;
  nodeCount: number;
};

export type GraphCanvasLaidOutNode = {
  id: string;
  laneId: string;
  /** Relative to the lane's top-left corner. */
  x: number;
  y: number;
  /** True when the position came from `positions`. */
  saved: boolean;
};

export type GraphCanvasLayout = {
  lanes: GraphCanvasLaidOutLane[];
  nodes: GraphCanvasLaidOutNode[];
};

type LayoutInput = {
  nodes: GraphCanvasNode[];
  lanes: GraphCanvasLane[];
  noLaneTitle: string;
  positions?: GraphCanvasPositions;
};

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Slot `index` of a lane's auto stack, relative to the lane. */
export const getStackSlot = (index: number) => ({
  x: GRAPH_CANVAS_LAYOUT.lanePadding,
  y: GRAPH_CANVAS_LAYOUT.laneHeader + index * (GRAPH_CANVAS_LAYOUT.nodeHeight + GRAPH_CANVAS_LAYOUT.nodeGap),
});

const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) < GRAPH_CANVAS_LAYOUT.nodeWidth && Math.abs(a.y - b.y) < GRAPH_CANVAS_LAYOUT.nodeHeight;

/**
 * Lays out lanes and nodes. Lanes keep their order and the fallback lane is last; it is shown when
 * it has nodes or when there are no lanes at all. Saved positions win when they belong to the
 * node's current lane; other nodes fill the first free stack slots in input order. Every lane gets
 * the same height: tall enough for the lowest node plus one free slot to drag into.
 */
export function computeGraphCanvasLayout({ nodes, lanes, noLaneTitle, positions }: LayoutInput): GraphCanvasLayout {
  const { laneWidth, laneGap, lanePadding, nodeHeight, nodeGap, minLaneHeight } = GRAPH_CANVAS_LAYOUT;
  const laneIds = new Set(lanes.map((lane) => lane.id));
  const resolveLane = (laneId: string | null) => (laneId && laneIds.has(laneId) ? laneId : GRAPH_CANVAS_NO_LANE_ID);

  // group nodes by lane, keeping input order
  const nodesByLane = new Map<string, GraphCanvasNode[]>();
  nodes.forEach((node) => {
    const laneId = resolveLane(node.laneId);
    const list = nodesByLane.get(laneId) ?? [];
    list.push(node);
    nodesByLane.set(laneId, list);
  });

  const orderedLanes: { id: string; title: string; isFallback: boolean }[] = lanes.map((lane) => ({
    id: lane.id,
    title: lane.title,
    isFallback: false,
  }));
  if (nodesByLane.has(GRAPH_CANVAS_NO_LANE_ID) || lanes.length === 0)
    orderedLanes.push({ id: GRAPH_CANVAS_NO_LANE_ID, title: noLaneTitle, isFallback: true });

  const laidOutNodes: GraphCanvasLaidOutNode[] = [];
  orderedLanes.forEach((lane) => {
    const laneNodes = nodesByLane.get(lane.id) ?? [];
    const taken: { x: number; y: number }[] = [];
    const pending: GraphCanvasNode[] = [];
    laneNodes.forEach((node) => {
      const saved = positions?.[node.id];
      if (saved && saved.laneId === lane.id && isFiniteNumber(saved.x) && isFiniteNumber(saved.y)) {
        const point = { x: Math.max(0, saved.x), y: Math.max(0, saved.y) };
        taken.push(point);
        laidOutNodes.push({ id: node.id, laneId: lane.id, ...point, saved: true });
      } else pending.push(node);
    });
    let slot = 0;
    pending.forEach((node) => {
      let point = getStackSlot(slot);
      while (taken.some((other) => overlaps(point, other))) {
        slot += 1;
        point = getStackSlot(slot);
      }
      taken.push(point);
      slot += 1;
      laidOutNodes.push({ id: node.id, laneId: lane.id, ...point, saved: false });
    });
  });

  const lowest = laidOutNodes.reduce((bottom, node) => Math.max(bottom, node.y + nodeHeight), 0);
  const height = Math.max(minLaneHeight, lowest + nodeGap + nodeHeight + lanePadding);

  return {
    lanes: orderedLanes.map(
      (lane, index): GraphCanvasLaidOutLane => ({
        id: lane.id,
        title: lane.title,
        isFallback: lane.isFallback,
        x: index * (laneWidth + laneGap),
        width: laneWidth,
        height,
        nodeCount: nodesByLane.get(lane.id)?.length ?? 0,
      })
    ),
    nodes: laidOutNodes,
  };
}

/** Clamps a dragged node's lane-relative position so it stays inside the lane. */
export function clampToLane(point: { x: number; y: number }, laneHeight: number) {
  const { laneWidth, nodeWidth, nodeHeight, laneHeader } = GRAPH_CANVAS_LAYOUT;
  return {
    x: Math.min(Math.max(0, point.x), laneWidth - nodeWidth),
    y: Math.min(Math.max(laneHeader, point.y), Math.max(laneHeader, laneHeight - nodeHeight)),
  };
}

/**
 * A new edge is allowed between two different, known nodes when no edge with the same direction
 * exists yet (edges are directed, so `b -> a` next to `a -> b` is fine).
 */
export function isAllowedGraphConnection(
  connection: { source: string | null | undefined; target: string | null | undefined },
  edges: { source: string; target: string }[],
  nodeIds: ReadonlySet<string>
): boolean {
  const { source, target } = connection;
  if (!source || !target || source === target) return false;
  if (!nodeIds.has(source) || !nodeIds.has(target)) return false;
  return !edges.some((edge) => edge.source === source && edge.target === target);
}
