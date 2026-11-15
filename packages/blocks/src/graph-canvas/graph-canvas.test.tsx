/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { GRAPH_CANVAS_THEME_STYLE, GraphCanvas } from "./graph-canvas";
import type { GraphCanvasEdge, GraphCanvasLabels, GraphCanvasLane, GraphCanvasNode } from "./graph-canvas.types";

// React Flow measures nodes (and their handles) when its ResizeObserver fires, reads the zoom
// from DOMMatrixReadOnly and measures SVG text; jsdom has none of these. Edges only render once
// both end nodes are measured, so this observer reports every observed element right away.
class MeasuringResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element): void {
    queueMicrotask(() => this.callback([{ target } as ResizeObserverEntry], this));
  }
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  globalThis.ResizeObserver = MeasuringResizeObserver;
  class TestDOMMatrixReadOnly {
    m22: number;
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([0-9.]+)\)/)?.[1];
      this.m22 = scale === undefined ? 1 : Number(scale);
    }
  }
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly ??= TestDOMMatrixReadOnly;
  const svgProto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect };
  svgProto.getBBox ??= () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
});

const LABELS: GraphCanvasLabels = {
  canvas: "Keyword map",
  noLane: "No phase",
  addEdgeLabel: "Add label",
  editEdgeLabel: "Edit label",
  edgeLabelInput: "Relation label",
  deleteEdge: "Delete relation",
  linkTo: "Link to",
  laneCount: (count) => `${count} keywords`,
};

const LANES: GraphCanvasLane[] = [
  { id: "discovery", title: "Discovery" },
  { id: "build", title: "Build" },
];

const NODES: GraphCanvasNode[] = [
  { id: "auth", label: "Auth", meta: "3 work items", laneId: "discovery" },
  { id: "billing", label: "Billing", laneId: "build" },
  { id: "misc", label: "Misc", laneId: null },
];

const EDGES: GraphCanvasEdge[] = [{ id: "e1", source: "auth", target: "billing", label: "feeds" }];

async function renderCanvas(props: Partial<Parameters<typeof GraphCanvas>[0]> = {}) {
  const view = render(
    <div style={{ width: 1200, height: 800 }}>
      <GraphCanvas nodes={NODES} lanes={LANES} edges={EDGES} labels={LABELS} {...props} />
    </div>
  );
  // let React Flow measure nodes and render edges
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return view;
}

describe("GraphCanvas", () => {
  it("renders the lanes in order with the fallback lane last, and the nodes", async () => {
    await renderCanvas();
    expect(screen.getByRole("region", { name: "Keyword map" })).toBeDefined();
    const lanes = screen.getAllByTestId("graph-canvas-lane").map((lane) => lane.textContent);
    expect(lanes).toEqual(["Discovery11 keywords", "Build11 keywords", "No phase11 keywords"]);
    expect(screen.getByRole("group", { name: "Auth, 3 work items" })).toBeDefined();
    expect(screen.getByText("3 work items")).toBeDefined();
    expect(screen.getByRole("group", { name: "Misc" })).toBeDefined();
  });

  it("maps React Flow's theme variables to Plane tokens that exist in light and dark", () => {
    const style = GRAPH_CANVAS_THEME_STYLE as Record<string, string>;
    const vars = Object.values(style)
      .flatMap((value) => [...String(value).matchAll(/var\((--[a-z0-9-]+)\)/g)].map((match) => match[1]))
      .filter((name): name is string => !!name);
    expect(vars.length).toBeGreaterThan(10);
    // every token is one of propel's semantic families (no made-up names like --bg-surface-1)
    vars.forEach((name) => expect(name).toMatch(/^--(background-color|border-color|text-color)-/));
    expect(style["--xy-background-color"]).toBe("var(--background-color-surface-1)");
    expect(style["--xy-edge-stroke"]).toBe("var(--border-color-strong)");
    expect(style["--xy-node-color"]).toBe("var(--text-color-primary)");
    expect(style["--xy-controls-button-background-color"]).toBe("var(--background-color-layer-1)");
  });

  it("applies the theme variables to the React Flow root", async () => {
    const { container } = await renderCanvas();
    const root = container.querySelector(".react-flow") as HTMLElement;
    expect(root.style.getPropertyValue("--xy-background-color")).toBe("var(--background-color-surface-1)");
    expect(root.style.getPropertyValue("--xy-edge-stroke-selected")).toBe("var(--border-color-accent-strong)");
  });

  it("opens a node on click and on Enter; each node is a single tab stop", async () => {
    const onNodeClick = vi.fn();
    await renderCanvas({ onNodeClick });
    // fireEvent: user-event's mousedown has no \`view\`, which d3-drag (node dragging) needs
    fireEvent.click(screen.getByText("Billing"));
    expect(onNodeClick).toHaveBeenCalledWith("billing");
    const node = screen.getByRole("group", { name: "Auth, 3 work items" });
    expect(node.tabIndex).toBe(0);
    expect(node.querySelectorAll("button, [tabindex='0'], a[href], input").length).toBe(0);
    fireEvent.keyDown(node, { key: "Enter" });
    expect(onNodeClick).toHaveBeenCalledWith("auth");
  });

  it("links a selected node to another one from the 'Link to' picker", async () => {
    const onConnect = vi.fn();
    await renderCanvas({ onConnect });
    expect(screen.queryByRole("button", { name: "Link to" })).toBeNull();
    fireEvent.click(screen.getByRole("group", { name: "Misc" }));
    await userEvent.click(await screen.findByRole("button", { name: "Link to" }));
    await userEvent.click(await screen.findByRole("option", { name: /Auth/ }));
    expect(onConnect).toHaveBeenCalledWith("misc", "auth");
  });

  it("disables 'Link to' targets that are already linked", async () => {
    const onConnect = vi.fn();
    await renderCanvas({ onConnect });
    fireEvent.click(screen.getByRole("group", { name: "Auth, 3 work items" }));
    await userEvent.click(await screen.findByRole("button", { name: "Link to" }));
    const billing = await screen.findByRole("option", { name: /Billing/ });
    expect(billing.getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(billing);
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("first click on a label selects the edge (delete button), the second edits", async () => {
    const onEdgeDelete = vi.fn();
    await renderCanvas({ onEdgeLabelChange: vi.fn(), onEdgeDelete });
    await userEvent.click(screen.getByRole("button", { name: "Edit label: feeds" }));
    expect(screen.queryByRole("textbox", { name: "Relation label" })).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: "Delete relation" }));
    expect(onEdgeDelete).toHaveBeenCalledWith("e1");
  });

  it("edits an edge label: Enter saves the trimmed text once", async () => {
    const onEdgeLabelChange = vi.fn();
    await renderCanvas({ onEdgeLabelChange });
    await userEvent.click(screen.getByRole("button", { name: "Edit label: feeds" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit label: feeds" }));
    const input = screen.getByRole("textbox", { name: "Relation label" });
    await userEvent.clear(input);
    await userEvent.type(input, "  blocks  {Enter}");
    expect(onEdgeLabelChange).toHaveBeenCalledTimes(1);
    expect(onEdgeLabelChange).toHaveBeenCalledWith("e1", "blocks");
    expect(screen.queryByRole("textbox", { name: "Relation label" })).toBeNull();
  });

  it("cancels a label edit with Escape", async () => {
    const onEdgeLabelChange = vi.fn();
    await renderCanvas({ onEdgeLabelChange });
    await userEvent.click(screen.getByRole("button", { name: "Edit label: feeds" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit label: feeds" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Relation label" }), "x{Escape}");
    expect(onEdgeLabelChange).not.toHaveBeenCalled();
    expect(screen.getByText("feeds")).toBeDefined();
  });

  it("offers 'Add label' on a selected edge without a label", async () => {
    const onEdgeLabelChange = vi.fn();
    const { container } = await renderCanvas({
      edges: [{ id: "e2", source: "auth", target: "misc", label: "" }],
      onEdgeLabelChange,
    });
    expect(screen.queryByRole("button", { name: "Add label" })).toBeNull();
    fireEvent.click(container.querySelector(".react-flow__edge") as Element);
    await userEvent.click(await screen.findByRole("button", { name: "Add label" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Relation label" }), "needs{Enter}");
    expect(onEdgeLabelChange).toHaveBeenCalledWith("e2", "needs");
  });

  it("draws an edge between two nodes of the same lane (routed via the right-side target)", async () => {
    await renderCanvas({
      nodes: [...NODES, { id: "search", label: "Search", laneId: "build" }],
      edges: [{ id: "same", source: "billing", target: "search", label: "next" }],
    });
    expect(screen.getByTestId("graph-canvas-edge-label-same").textContent).toBe("next");
  });

  it("deletes a selected edge with its delete button", async () => {
    const onEdgeDelete = vi.fn();
    const { container } = await renderCanvas({ onEdgeDelete, onEdgeLabelChange: vi.fn() });
    const edge = container.querySelector(".react-flow__edge");
    expect(edge).not.toBeNull();
    fireEvent.click(edge as Element);
    await userEvent.click(await screen.findByRole("button", { name: "Delete relation" }));
    expect(onEdgeDelete).toHaveBeenCalledWith("e1");
  });

  it("deletes a selected edge with the Delete key", async () => {
    const onEdgeDelete = vi.fn();
    const { container } = await renderCanvas({ onEdgeDelete });
    fireEvent.click(container.querySelector(".react-flow__edge") as Element);
    await screen.findByRole("button", { name: "Delete relation" });
    fireEvent.keyDown(document.body, { key: "Delete" });
    fireEvent.keyUp(document.body, { key: "Delete" });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(onEdgeDelete).toHaveBeenCalledWith("e1");
  });

  it("is read-only: no label editing, no delete button, no connectable handles", async () => {
    const onEdgeLabelChange = vi.fn();
    const { container } = await renderCanvas({ readOnly: true, onEdgeLabelChange, onEdgeDelete: vi.fn() });
    const label = within(screen.getByTestId("graph-canvas-edge-label-e1")).getByRole("button");
    expect((label as HTMLButtonElement).disabled).toBe(true);
    const edge = container.querySelector(".react-flow__edge");
    fireEvent.click(edge as Element);
    expect(screen.queryByRole("button", { name: "Delete relation" })).toBeNull();
    expect(container.querySelector(".react-flow__handle.connectable")).toBeNull();
  });
});
