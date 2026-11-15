/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { BaseEdge, EdgeLabelRenderer, Position, getBezierPath } from "@xyflow/react";
import type { Edge, EdgeProps } from "@xyflow/react";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { CloseOutline } from "@makeplane/propel/icons";
import { cn } from "@plane/utils";
import { useGraphCanvasContext } from "./context";

export type GraphCanvasEdgeData = {
  label: string;
};

export type GraphCanvasFlowEdge = Edge<GraphCanvasEdgeData, "labeled">;

/** Max label length; matches the API's `ModuleRelation.label` column. */
export const GRAPH_CANVAS_EDGE_LABEL_MAX_LENGTH = 255;

/** Edge labels sit above the nodes (React Flow draws them below) so they stay readable and clickable. */
const LABEL_Z_INDEX = 1001;

/**
 * Path for an edge that leaves and enters on the right side (two nodes in the same lane): a curve
 * that bows out to the right, further for nodes far apart. Returns `[path, labelX, labelY]`.
 */
export function getSameSidePath(sourceX: number, sourceY: number, targetX: number, targetY: number) {
  const offset = 48 + Math.abs(targetY - sourceY) * 0.25;
  const controlX = Math.max(sourceX, targetX) + offset;
  const path = `M ${sourceX},${sourceY} C ${controlX},${sourceY} ${controlX},${targetY} ${targetX},${targetY}`;
  // cubic bezier midpoint (t = 0.5)
  const labelX = (sourceX + targetX) / 8 + (controlX * 3) / 4;
  const labelY = (sourceY + targetY) / 2;
  return [path, labelX, labelY] as const;
}

/**
 * Directed bezier edge (arrowhead from `markerEnd`) with a text label in the middle. Editable
 * canvases: a click on the label selects the edge, a click on a selected edge's label (or "Add
 * label") edits; Enter or blur saves, Escape cancels. A selected edge shows a delete button; the Delete key also works.
 */
export function GraphCanvasLabeledEdge(props: EdgeProps<GraphCanvasFlowEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, selected, data } = props;
  const { readOnly, labels, onEdgeLabelChange, onEdgeDelete, onEdgeSelect } = useGraphCanvasContext();
  const label = data?.label ?? "";
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  // set once Enter saved or Escape cancelled, so the blur that follows (input unmount) does nothing
  const finishedRef = useRef(false);
  const [path, labelX, labelY] =
    sourcePosition === Position.Right && targetPosition === Position.Right
      ? getSameSidePath(sourceX, sourceY, targetX, targetY)
      : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  const canEditLabel = !readOnly && !!onEdgeLabelChange;
  const canDelete = !readOnly && !!onEdgeDelete;

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const startEditing = () => {
    if (!canEditLabel) return;
    finishedRef.current = false;
    setDraft(label);
    setIsEditing(true);
  };

  // first click on the label of an unselected edge selects it (shows delete); the next one edits
  const handleLabelClick = () => {
    if (!selected) onEdgeSelect(id);
    else startEditing();
  };

  const finish = (save: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setIsEditing(false);
    const next = draft.trim();
    if (save && next !== label) onEdgeLabelChange?.(id, next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // keep Backspace/Delete from reaching React Flow's delete shortcut
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  };

  const showLabelButton = !!label || (canEditLabel && selected);

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} interactionWidth={20} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute flex items-center gap-1"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, zIndex: LABEL_Z_INDEX }}
          data-testid={`graph-canvas-edge-label-${id}`}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              value={draft}
              maxLength={GRAPH_CANVAS_EDGE_LABEL_MAX_LENGTH}
              aria-label={labels.edgeLabelInput}
              className="h-6 w-40 rounded-sm border border-accent-strong bg-surface-1 px-1.5 text-caption-sm-regular text-primary outline-none"
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => finish(true)}
              onKeyDown={handleKeyDown}
            />
          ) : (
            showLabelButton && (
              <button
                type="button"
                className={cn(
                  "max-w-48 truncate rounded-sm border bg-surface-1 px-1.5 py-0.5 text-caption-sm-regular",
                  label ? "text-secondary" : "text-placeholder",
                  selected ? "border-accent-strong" : "border-subtle",
                  !canEditLabel && "cursor-default"
                )}
                aria-label={canEditLabel && label ? `${labels.editEdgeLabel}: ${label}` : undefined}
                title={label || undefined}
                onClick={canEditLabel ? handleLabelClick : undefined}
                disabled={!canEditLabel}
              >
                {label || labels.addEdgeLabel}
              </button>
            )
          )}
          {canDelete && selected && !isEditing && (
            <span className="rounded-sm bg-surface-1">
              <IconButton
                variant="ghost"
                size="xs"
                aria-label={labels.deleteEdge}
                icon={<Icon icon={CloseOutline} />}
                onClick={() => onEdgeDelete?.(id)}
              />
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
