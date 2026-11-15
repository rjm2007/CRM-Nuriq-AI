/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: pure helpers for project phases (Step 2). A keyword is Plane's `Module`.

import { PHASE_SEQUENCE_GAP } from "@plane/constants";

type TSequenced = { id: string; sequence: number };
type TDated = { start_date?: string | null; target_date?: string | null };

/** `YYYY-MM-DD` part of an API date or datetime string, or `null`. String order is date order. */
const toDay = (value: string | null | undefined): string | null => (value ? value.slice(0, 10) : null);

/**
 * Sequence for a phase dropped on the `edge` of `targetId` in `phases` (already in display order):
 * the midpoint to the neighbour, or one gap past the first/last phase. Same idea as Plane's
 * `getCurrentStateSequence`, but a sequence of 0 is valid here.
 */
export const getPhaseDropSequence = (
  phases: TSequenced[],
  targetId: string,
  edge: "top" | "bottom" | null | undefined
): number | undefined => {
  const index = phases.findIndex((phase) => phase.id === targetId);
  const target = phases[index];
  if (!target || !edge) return undefined;
  const neighbour = edge === "top" ? phases[index - 1] : phases[index + 1];
  if (!neighbour) return edge === "top" ? target.sequence - PHASE_SEQUENCE_GAP : target.sequence + PHASE_SEQUENCE_GAP;
  return (target.sequence + neighbour.sequence) / 2;
};

/** Span covered by the keywords' own dates: earliest start and latest target (each `null` if none set). */
export const getPhaseKeywordSpan = (keywords: TDated[]): { start_date: string | null; target_date: string | null } => {
  let start: string | null = null;
  let end: string | null = null;
  keywords.forEach((keyword) => {
    const from = toDay(keyword.start_date);
    const to = toDay(keyword.target_date);
    if (from && (!start || from < start)) start = from;
    if (to && (!end || to > end)) end = to;
  });
  return { start_date: start, target_date: end };
};

/**
 * True when a keyword has a date before the phase start or after the phase target. Only dates that are
 * set on both sides are compared; this is a warning, never a blocker (the API accepts it too).
 */
export const isKeywordOutsidePhaseDates = (phase: TDated, keyword: TDated): boolean => {
  const phaseStart = toDay(phase.start_date);
  const phaseEnd = toDay(phase.target_date);
  const dates = [toDay(keyword.start_date), toDay(keyword.target_date)].filter((date): date is string => !!date);
  return dates.some((date) => (!!phaseStart && date < phaseStart) || (!!phaseEnd && date > phaseEnd));
};

export type TPhaseActivityKind = "moved" | "added" | "removed";

/**
 * Kind of a work item `phase` activity row (`apps/api/plane/bgtasks/phase_activity.py`): old/new values
 * are phase names, either may be empty. `undefined` when both are empty (nothing to show).
 */
export const getPhaseActivityKind = (activity: {
  old_value?: string | null;
  new_value?: string | null;
}): TPhaseActivityKind | undefined => {
  if (activity.old_value && activity.new_value) return "moved";
  if (activity.new_value) return "added";
  if (activity.old_value) return "removed";
  return undefined;
};
