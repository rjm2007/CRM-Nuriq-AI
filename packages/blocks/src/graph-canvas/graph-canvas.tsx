/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// React Flow's stylesheet; @xyflow/react stays external in the build, so the app's bundler (Vite)
// resolves and injects it together with the lazily loaded canvas chunk.
// oxlint-disable-next-line import/no-unassigned-import -- side-effect CSS import for React Flow
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
} from "@xyflow/react";
import type {
  AriaLabelConfig,
  Connection,
  Edge,
  EdgeChange,
  EdgeTypes,
  IsValidConnection,
  NodeChange,
  NodeTypes,
  OnNodeDrag,
} from "@xyflow/react";
import { cn } from "@plane/utils";
import { GraphCanvasContext } from "./context";
import type { GraphCanvasContextValue, GraphCanvasLinkOption } from "./context";
import type { GraphCanvasEdge, GraphCanvasPositions, GraphCanvasProps } from "./graph-canvas.types";
import { GRAPH_CANVAS_HANDLES, GraphCanvasItemNode } from "./item-node";
import type { GraphCanvasItemFlowNode } from "./item-node";
import { GraphCanvasLabeledEdge } from "./labeled-edge";
import type { GraphCanvasFlowEdge } from "./labeled-edge";
import { GraphCanvasLaneNode } from "./lane-node";
import type { GraphCanvasLaneFlowNode } from "./lane-node";
import { GRAPH_CANVAS_LAYOUT, clampToLane, computeGraphCanvasLayout, isAllowedGraphConnection } from "./layout";

type FlowNode = GraphCanvasLaneFlowNode | GraphCanvasItemFlowNode;

const LANE_NODE_PREFIX = "lane:";

const nodeTypes: NodeTypes = { lane: GraphCanvasLaneNode, item: GraphCanvasItemNode };
const edgeTypes: EdgeTypes = { labeled: GraphCanvasLabeledEdge };

/**
 * React Flow theme variables mapped to Plane's semantic tokens (propel's `variables.css`, which
 * switches them per theme), so light and dark both work.
 */
export const GRAPH_CANVAS_THEME_STYLE = {
  "--xy-background-color": "var(--background-color-surface-1)",
  "--xy-background-pattern-color": "var(--border-color-subtle)",
  "--xy-edge-stroke": "var(--border-color-strong)",
  "--xy-edge-stroke-selected": "var(--border-color-accent-strong)",
  "--xy-edge-stroke-width": "1.5",
  "--xy-connectionline-stroke": "var(--border-color-accent-strong)",
  "--xy-handle-background-color": "var(--background-color-accent-primary)",
  "--xy-handle-border-color": "var(--background-color-surface-1)",
  "--xy-node-background-color": "transparent",
  "--xy-node-border": "none",
  "--xy-node-boxshadow-selected": "none",
  "--xy-node-boxshadow-hover": "none",
  "--xy-node-color": "var(--text-color-primary)",
  "--xy-controls-button-background-color": "var(--background-color-layer-1)",
  "--xy-controls-button-background-color-hover": "var(--background-color-layer-1-hover)",
  "--xy-controls-button-color": "var(--text-color-secondary)",
  "--xy-controls-button-color-hover": "var(--text-color-primary)",
  "--xy-controls-button-border-color": "var(--border-color-subtle)",
  "--xy-controls-box-shadow": "none",
  "--xy-attribution-background-color": "transparent",
  "--xy-selection-background-color": "var(--background-color-accent-subtle)",
  "--xy-selection-border": "1px dotted var(--border-color-accent-strong)",
} as CSSProperties;

const ARROW = { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "var(--border-color-strong)" } as const;
const ARROW_SELECTED = { ...ARROW, color: "var(--border-color-accent-strong)" } as const;

const laneNodeId = (laneId: string) => `${LANE_NODE_PREFIX}${laneId}`;

function toFlowEdges(
  edges: GraphCanvasEdge[],
  readOnly: boolean,
  selectedIds: Set<string>,
  laneByNodeId: Map<string, string>
): GraphCanvasFlowEdge[] {
  return edges.map((edge) => {
    const selected = selectedIds.has(edge.id);
    const sameLane = laneByNodeId.get(edge.source) === laneByNodeId.get(edge.target);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: GRAPH_CANVAS_HANDLES.source,
      targetHandle: sameLane ? GRAPH_CANVAS_HANDLES.sameLaneTarget : GRAPH_CANVAS_HANDLES.target,
      type: "labeled",
      data: { label: edge.label ?? "" },
      markerEnd: selected ? ARROW_SELECTED : ARROW,
      deletable: !readOnly,
      selected,
    };
  });
}

function GraphCanvasInner(props: GraphCanvasProps) {
  const {
    nodes,
    lanes,
    edges,
    labels,
    positions,
    onPositionsChange,
    onConnect,
    onEdgeLabelChange,
    onEdgeDelete,
    onNodeClick,
    readOnly = false,
    className,
  } = props;

  const layout = useMemo(
    () => computeGraphCanvasLayout({ nodes, lanes, positions, noLaneTitle: labels.noLane }),
    [nodes, lanes, positions, labels.noLane]
  );

  const layoutNodes = useMemo<FlowNode[]>(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const laneNodes: GraphCanvasLaneFlowNode[] = layout.lanes.map((lane) => ({
      id: laneNodeId(lane.id),
      type: "lane",
      position: { x: lane.x, y: 0 },
      data: { title: lane.title, count: lane.nodeCount, isFallback: lane.isFallback },
      width: lane.width,
      height: lane.height,
      style: { width: lane.width, height: lane.height },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      deletable: false,
      zIndex: -1,
    }));
    const itemNodes: GraphCanvasItemFlowNode[] = layout.nodes.map((placed) => {
      const node = byId.get(placed.id);
      return {
        id: placed.id,
        type: "item",
        parentId: laneNodeId(placed.laneId),
        extent: "parent",
        position: { x: placed.x, y: placed.y },
        data: { label: node?.label ?? "", meta: node?.meta },
        ariaLabel: [node?.label, node?.meta].filter(Boolean).join(", "),
        width: GRAPH_CANVAS_LAYOUT.nodeWidth,
        height: GRAPH_CANVAS_LAYOUT.nodeHeight,
        style: { width: GRAPH_CANVAS_LAYOUT.nodeWidth, height: GRAPH_CANVAS_LAYOUT.nodeHeight },
        deletable: false,
        connectable: !readOnly,
      };
    });
    // parents must come before their children
    return [...laneNodes, ...itemNodes];
  }, [layout, nodes, readOnly]);

  const [flowNodes, setFlowNodes] = useState<FlowNode[]>(layoutNodes);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(() => new Set());

  // re-sync when the inputs change, keeping the node selection; a node being dragged keeps its
  // live position (else it snaps back while a store update re-renders the canvas mid-drag)
  useEffect(() => {
    setFlowNodes((current) => {
      const currentById = new Map(current.map((node) => [node.id, node]));
      return layoutNodes.map((node) => {
        const live = currentById.get(node.id);
        if (!live) return node;
        if (live.dragging) return { ...node, position: live.position, dragging: true, selected: live.selected };
        return live.selected ? { ...node, selected: true } : node;
      });
    });
  }, [layoutNodes]);

  const laneByNodeId = useMemo(() => new Map(layout.nodes.map((placed) => [placed.id, placed.laneId])), [layout.nodes]);
  const flowEdges = useMemo(
    () => toFlowEdges(edges, readOnly, selectedEdgeIds, laneByNodeId),
    [edges, readOnly, selectedEdgeIds, laneByNodeId]
  );

  const handleNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setFlowNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<GraphCanvasFlowEdge>[]) => {
      // only selection is local; removals go through onEdgesDelete -> onEdgeDelete
      const selectionChanges = changes.filter((change) => change.type === "select");
      if (selectionChanges.length === 0) return;
      setSelectedEdgeIds((current) => {
        const next = applyEdgeChanges(selectionChanges, toFlowEdges(edges, readOnly, current, laneByNodeId));
        return new Set(next.filter((edge) => edge.selected).map((edge) => edge.id));
      });
    },
    [edges, laneByNodeId, readOnly]
  );

  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (readOnly || !onEdgeDelete) return;
      deleted.forEach((edge) => onEdgeDelete(edge.id));
    },
    [onEdgeDelete, readOnly]
  );

  const nodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const isValidConnection = useCallback<IsValidConnection>(
    (connection) => isAllowedGraphConnection(connection, edges, nodeIds),
    [edges, nodeIds]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (readOnly || !onConnect || !isValidConnection(connection)) return;
      onConnect(connection.source, connection.target);
    },
    [isValidConnection, onConnect, readOnly]
  );

  const handleNodeDragStop = useCallback<OnNodeDrag<FlowNode>>(
    (_event, _node, draggedNodes) => {
      if (!onPositionsChange) return;
      const laneHeights = new Map(layout.lanes.map((lane) => [laneNodeId(lane.id), lane.height]));
      const next: GraphCanvasPositions = { ...positions };
      draggedNodes.forEach((dragged) => {
        if (dragged.type !== "item" || !dragged.parentId) return;
        const point = clampToLane(dragged.position, laneHeights.get(dragged.parentId) ?? 0);
        next[dragged.id] = {
          laneId: dragged.parentId.slice(LANE_NODE_PREFIX.length),
          x: Math.round(point.x),
          y: Math.round(point.y),
        };
      });
      onPositionsChange(next);
    },
    [layout.lanes, onPositionsChange, positions]
  );

  const handleEdgeSelect = useCallback((edgeId: string) => {
    setSelectedEdgeIds(new Set([edgeId]));
    setFlowNodes((current) => current.map((node) => (node.selected ? { ...node, selected: false } : node)));
  }, []);

  const getLinkOptions = useCallback(
    (nodeId: string): GraphCanvasLinkOption[] =>
      nodes
        .filter((node) => node.id !== nodeId)
        .map((node) => ({
          id: node.id,
          name: node.label,
          disabled: !isAllowedGraphConnection({ source: nodeId, target: node.id }, edges, nodeIds),
        })),
    [edges, nodeIds, nodes]
  );

  const handleLink = useCallback(
    (source: string, target: string) => handleConnect({ source, target, sourceHandle: null, targetHandle: null }),
    [handleConnect]
  );

  // Enter on a focused node opens it (the node wrapper is the only tab stop; Space selects it)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" || !onNodeClick) return;
      const target = event.target as HTMLElement;
      if (!target.classList.contains("react-flow__node-item")) return;
      const nodeId = target.dataset.id;
      if (nodeId) onNodeClick(nodeId);
    },
    [onNodeClick]
  );

  const contextValue = useMemo<GraphCanvasContextValue>(
    () => ({
      readOnly,
      labels,
      onNodeClick,
      onEdgeLabelChange,
      onEdgeDelete,
      onEdgeSelect: handleEdgeSelect,
      onLink: !readOnly && onConnect ? handleLink : undefined,
      getLinkOptions,
    }),
    [
      getLinkOptions,
      handleEdgeSelect,
      handleLink,
      labels,
      onConnect,
      onEdgeDelete,
      onEdgeLabelChange,
      onNodeClick,
      readOnly,
    ]
  );

  const ariaLabelConfig = useMemo<Partial<AriaLabelConfig>>(() => {
    const config: Partial<AriaLabelConfig> = {};
    if (labels.zoomIn) config["controls.zoomIn.ariaLabel"] = labels.zoomIn;
    if (labels.zoomOut) config["controls.zoomOut.ariaLabel"] = labels.zoomOut;
    if (labels.fitView) config["controls.fitView.ariaLabel"] = labels.fitView;
    if (labels.controls) config["controls.ariaLabel"] = labels.controls;
    return config;
  }, [labels.controls, labels.fitView, labels.zoomIn, labels.zoomOut]);

  return (
    <GraphCanvasContext.Provider value={contextValue}>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- delegates Enter from the focusable nodes inside */}
      <section aria-label={labels.canvas} className={cn("relative size-full", className)} onKeyDown={handleKeyDown}>
        <ReactFlow<FlowNode, GraphCanvasFlowEdge>
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onEdgesDelete={handleEdgesDelete}
          onConnect={handleConnect}
          onNodeDragStop={handleNodeDragStop}
          isValidConnection={isValidConnection}
          nodesConnectable={!readOnly}
          edgesReconnectable={false}
          deleteKeyCode={readOnly ? null : ["Delete", "Backspace"]}
          ariaLabelConfig={ariaLabelConfig}
          minZoom={0.2}
          maxZoom={2}
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
          style={GRAPH_CANVAS_THEME_STYLE}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
      </section>
    </GraphCanvasContext.Provider>
  );
}

/**
 * Generic directed-graph canvas (React Flow) with ordered vertical swimlanes. Props-driven: no
 * stores or API calls. Default export too, so apps can `React.lazy` it.
 */
export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

export default GraphCanvas;
