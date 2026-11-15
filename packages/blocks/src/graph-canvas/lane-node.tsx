/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Node, NodeProps } from "@xyflow/react";
import { cn } from "@plane/utils";
import { useGraphCanvasContext } from "./context";

export type GraphCanvasLaneNodeData = {
  title: string;
  count: number;
  isFallback: boolean;
};

export type GraphCanvasLaneFlowNode = Node<GraphCanvasLaneNodeData, "lane">;

/** Background column with the lane title; not draggable, selectable or connectable. */
export function GraphCanvasLaneNode({ data }: NodeProps<GraphCanvasLaneFlowNode>) {
  const { labels } = useGraphCanvasContext();
  return (
    <div
      className={cn(
        "size-full rounded-lg border border-subtle bg-layer-1/60",
        data.isFallback && "border-dashed bg-transparent"
      )}
      data-testid="graph-canvas-lane"
    >
      <div className="flex h-12 items-center justify-between gap-2 px-4">
        <span className="truncate text-body-xs-medium text-primary" title={data.title}>
          {data.title}
        </span>
        <span className="shrink-0 text-caption-sm-regular text-tertiary">
          <span aria-hidden="true">{data.count}</span>
          <span className="sr-only">{labels.laneCount?.(data.count) ?? String(data.count)}</span>
        </span>
      </div>
    </div>
  );
}
