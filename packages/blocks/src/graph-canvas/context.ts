/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createContext, useContext } from "react";
import type { GraphCanvasLabels } from "./graph-canvas.types";

/** A node the "link to" picker offers; `disabled` when that edge already exists. */
export type GraphCanvasLinkOption = {
  id: string;
  name: string;
  disabled: boolean;
};

/** Callbacks and flags the custom node/edge renderers need (kept out of React Flow's node data). */
export type GraphCanvasContextValue = {
  readOnly: boolean;
  labels: GraphCanvasLabels;
  onNodeClick?: (nodeId: string) => void;
  onEdgeLabelChange?: (edgeId: string, label: string) => void;
  onEdgeDelete?: (edgeId: string) => void;
  /** Selects one edge (and clears the other edge selection). */
  onEdgeSelect: (edgeId: string) => void;
  /** Set when edges can be created from the keyboard ("link to" picker on a selected node). */
  onLink?: (source: string, target: string) => void;
  /** Targets the "link to" picker offers for `nodeId` (every other node). */
  getLinkOptions: (nodeId: string) => GraphCanvasLinkOption[];
};

export const GraphCanvasContext = createContext<GraphCanvasContextValue | null>(null);

export function useGraphCanvasContext(): GraphCanvasContextValue {
  const value = useContext(GraphCanvasContext);
  if (!value) throw new Error("useGraphCanvasContext must be used inside GraphCanvas");
  return value;
}
