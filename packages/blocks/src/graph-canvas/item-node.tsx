/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { LinkOutline } from "@makeplane/propel/icons";
import { cn } from "@plane/utils";
import { Select } from "../select/select";
import { useGraphCanvasContext } from "./context";
import type { GraphCanvasLinkOption } from "./context";

export type GraphCanvasItemNodeData = {
  label: string;
  meta?: string;
};

export type GraphCanvasItemFlowNode = Node<GraphCanvasItemNodeData, "item">;

/** Handle ids. \`in-right\` only routes edges between nodes of the same lane (it takes no drops). */
export const GRAPH_CANVAS_HANDLES = { source: "out", target: "in", sameLaneTarget: "in-right" } as const;

/** "Link to…" picker on a selected node: the keyboard way to create an edge from this node. */
function GraphCanvasLinkPicker({ nodeId }: { nodeId: string }) {
  const { labels, onLink, getLinkOptions } = useGraphCanvasContext();
  if (!onLink || !labels.linkTo) return null;
  return (
    <div className="nodrag nopan absolute -top-3 right-2 rounded-sm bg-surface-1 shadow-raised-100">
      <Select<GraphCanvasLinkOption>
        getValues={() => getLinkOptions(nodeId)}
        value={null}
        onChange={(targetId) => {
          if (targetId) onLink(nodeId, targetId);
        }}
        placeholder={labels.linkTo}
        getOptionValue={(option) => option.id}
        getOptionLabel={(option) => option.name}
        getOptionDisabled={(option) => option.disabled}
      >
        <Select.Trigger<GraphCanvasLinkOption> variant="icon-sm" prependIcon={<LinkOutline />} />
      </Select>
    </div>
  );
}

/**
 * A node card, one tab stop: React Flow's node wrapper is the focus target (Enter opens the item via
 * the canvas' key handler, Space selects, arrows move). A click on the body opens the item; React
 * Flow's drag suppresses the click after a move. A selected, editable node shows a "Link to…"
 * picker. Target handle on the left, source on the right; a hidden right-side target lets same-lane
 * edges bow out to the right instead of crossing the node.
 */
export function GraphCanvasItemNode({ id, data, selected }: NodeProps<GraphCanvasItemFlowNode>) {
  const { readOnly, onNodeClick } = useGraphCanvasContext();
  const handleClass = cn("!size-2.5", readOnly && "!invisible");
  return (
    <div
      className={cn(
        "relative flex size-full items-center rounded-md border bg-surface-1 shadow-raised-100 transition-colors",
        selected ? "border-accent-strong" : "border-subtle hover:border-strong"
      )}
    >
      <Handle
        id={GRAPH_CANVAS_HANDLES.target}
        type="target"
        position={Position.Left}
        className={handleClass}
        isConnectable={!readOnly}
      />
      {/* keyboard: the focusable node wrapper handles Enter (see GraphCanvas onKeyDown) */}
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the node wrapper is the single tab stop and handles Enter */}
      <div
        className={cn(
          "flex size-full min-w-0 flex-col justify-center rounded-md px-3 text-left",
          onNodeClick && "cursor-pointer"
        )}
        onClick={() => onNodeClick?.(id)}
      >
        <span className="w-full truncate text-body-xs-medium text-primary" title={data.label}>
          {data.label}
        </span>
        {data.meta && <span className="w-full truncate text-caption-sm-regular text-tertiary">{data.meta}</span>}
      </div>
      {selected && !readOnly && <GraphCanvasLinkPicker nodeId={id} />}
      <Handle
        id={GRAPH_CANVAS_HANDLES.source}
        type="source"
        position={Position.Right}
        className={handleClass}
        isConnectable={!readOnly}
      />
      <Handle
        id={GRAPH_CANVAS_HANDLES.sameLaneTarget}
        type="target"
        position={Position.Right}
        className="!pointer-events-none !invisible"
        isConnectable={false}
      />
    </div>
  );
}
