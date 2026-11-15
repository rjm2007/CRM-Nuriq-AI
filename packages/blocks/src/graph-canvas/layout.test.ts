/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import type { GraphCanvasLane, GraphCanvasNode } from "./graph-canvas.types";
import {
  GRAPH_CANVAS_LAYOUT,
  GRAPH_CANVAS_NO_LANE_ID,
  clampToLane,
  computeGraphCanvasLayout,
  getStackSlot,
  isAllowedGraphConnection,
} from "./layout";

const LANES: GraphCanvasLane[] = [
  { id: "discovery", title: "Discovery" },
  { id: "build", title: "Build" },
];

const node = (id: string, laneId: string | null): GraphCanvasNode => ({ id, label: id.toUpperCase(), laneId });

describe("computeGraphCanvasLayout", () => {
  it("keeps lane order, spaces lanes evenly and gives every lane the same height", () => {
    const layout = computeGraphCanvasLayout({
      nodes: [node("a", "build"), node("b", "discovery")],
      lanes: LANES,
      noLaneTitle: "No phase",
    });
    expect(layout.lanes.map((lane) => lane.id)).toEqual(["discovery", "build"]);
    expect(layout.lanes[0].x).toBe(0);
    expect(layout.lanes[1].x).toBe(GRAPH_CANVAS_LAYOUT.laneWidth + GRAPH_CANVAS_LAYOUT.laneGap);
    expect(new Set(layout.lanes.map((lane) => lane.height)).size).toBe(1);
    expect(layout.lanes[0].height).toBeGreaterThanOrEqual(GRAPH_CANVAS_LAYOUT.minLaneHeight);
  });

  it("puts nodes without a known lane in a fallback lane that comes last", () => {
    const layout = computeGraphCanvasLayout({
      nodes: [node("a", null), node("b", "gone"), node("c", "build")],
      lanes: LANES,
      noLaneTitle: "No phase",
    });
    const last = layout.lanes.at(-1);
    expect(last).toMatchObject({ id: GRAPH_CANVAS_NO_LANE_ID, title: "No phase", isFallback: true, nodeCount: 2 });
    expect(layout.nodes.filter((placed) => placed.laneId === GRAPH_CANVAS_NO_LANE_ID).map((p) => p.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("hides the fallback lane when every node has a lane, and shows it when there are no lanes", () => {
    expect(
      computeGraphCanvasLayout({ nodes: [node("a", "build")], lanes: LANES, noLaneTitle: "No phase" }).lanes
    ).toHaveLength(2);
    const noLanes = computeGraphCanvasLayout({ nodes: [], lanes: [], noLaneTitle: "No phase" });
    expect(noLanes.lanes.map((lane) => lane.id)).toEqual([GRAPH_CANVAS_NO_LANE_ID]);
  });

  it("stacks nodes in input order inside their lane", () => {
    const layout = computeGraphCanvasLayout({
      nodes: [node("a", "build"), node("b", "build"), node("c", "build")],
      lanes: LANES,
      noLaneTitle: "No phase",
    });
    expect(layout.nodes.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: "a", ...getStackSlot(0) },
      { id: "b", ...getStackSlot(1) },
      { id: "c", ...getStackSlot(2) },
    ]);
  });

  it("uses a saved position only while the node stays in the saved lane", () => {
    const layout = computeGraphCanvasLayout({
      nodes: [node("a", "build"), node("b", "discovery")],
      lanes: LANES,
      noLaneTitle: "No phase",
      positions: { a: { laneId: "build", x: 10, y: 400 }, b: { laneId: "build", x: 10, y: 400 } },
    });
    expect(layout.nodes.find((placed) => placed.id === "a")).toMatchObject({ x: 10, y: 400, saved: true });
    expect(layout.nodes.find((placed) => placed.id === "b")).toMatchObject({ ...getStackSlot(0), saved: false });
    // the lanes grow to fit the lowest node plus one free slot
    expect(layout.lanes[0].height).toBeGreaterThanOrEqual(400 + GRAPH_CANVAS_LAYOUT.nodeHeight * 2);
  });

  it("skips stack slots taken by saved nodes and ignores broken saved values", () => {
    const layout = computeGraphCanvasLayout({
      nodes: [node("a", "build"), node("b", "build"), node("c", "build")],
      lanes: LANES,
      noLaneTitle: "No phase",
      positions: {
        a: { laneId: "build", ...getStackSlot(0) },
        c: { laneId: "build", x: Number.NaN, y: 3 },
      },
    });
    expect(layout.nodes.find((placed) => placed.id === "b")).toMatchObject(getStackSlot(1));
    expect(layout.nodes.find((placed) => placed.id === "c")).toMatchObject({ ...getStackSlot(2), saved: false });
  });
});

describe("clampToLane", () => {
  it("keeps a dragged node inside the lane body, below the header", () => {
    expect(clampToLane({ x: -20, y: 0 }, 400)).toEqual({ x: 0, y: GRAPH_CANVAS_LAYOUT.laneHeader });
    expect(clampToLane({ x: 999, y: 999 }, 400)).toEqual({
      x: GRAPH_CANVAS_LAYOUT.laneWidth - GRAPH_CANVAS_LAYOUT.nodeWidth,
      y: 400 - GRAPH_CANVAS_LAYOUT.nodeHeight,
    });
  });
});

describe("isAllowedGraphConnection", () => {
  const ids = new Set(["a", "b", "c"]);
  const edges = [{ source: "a", target: "b" }];

  it("allows a new directed edge, including the reverse of an existing one", () => {
    expect(isAllowedGraphConnection({ source: "a", target: "c" }, edges, ids)).toBe(true);
    expect(isAllowedGraphConnection({ source: "b", target: "a" }, edges, ids)).toBe(true);
  });

  it("blocks self-links, duplicates, unknown nodes and missing ends", () => {
    expect(isAllowedGraphConnection({ source: "a", target: "a" }, edges, ids)).toBe(false);
    expect(isAllowedGraphConnection({ source: "a", target: "b" }, edges, ids)).toBe(false);
    expect(isAllowedGraphConnection({ source: "lane:x", target: "b" }, edges, ids)).toBe(false);
    expect(isAllowedGraphConnection({ source: null, target: "b" }, edges, ids)).toBe(false);
  });
});
