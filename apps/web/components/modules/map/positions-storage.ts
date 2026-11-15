/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: keyword-map node positions, saved per user + project in localStorage (Step 2, v1).

import type { GraphCanvasPositions } from "@plane/blocks/graph-canvas";

export const getKeywordMapPositionsKey = (userId: string, projectId: string) =>
  `neuric_keyword_map_positions:${userId}:${projectId}`;

const isPosition = (value: unknown): value is GraphCanvasPositions[string] => {
  if (!value || typeof value !== "object") return false;
  const { laneId, x, y } = value as Record<string, unknown>;
  return typeof laneId === "string" && Number.isFinite(x) && Number.isFinite(y);
};

/** Saved positions, or `{}` when nothing is saved, storage is blocked or the value is broken. */
export function readKeywordMapPositions(key: string): GraphCanvasPositions {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const positions: GraphCanvasPositions = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([id, value]) => {
      if (isPosition(value)) positions[id] = { laneId: value.laneId, x: value.x, y: value.y };
    });
    return positions;
  } catch {
    return {};
  }
}

/** Saves positions; a full or blocked storage is ignored (positions are a convenience). */
export function writeKeywordMapPositions(key: string, positions: GraphCanvasPositions): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(positions));
  } catch {
    // ignore: quota exceeded or storage disabled
  }
}
