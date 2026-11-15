/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: pure helpers for the subtask rules (see apps/api/plane/utils/subtask_rules.py).
// plane imports
import { SUBTASK_RULE_ERROR_CODES } from "@plane/constants";
import type { TSubtaskRuleErrorCode } from "@plane/constants";
import type { TIssue, TStateGroups } from "@plane/types";
// local imports
import { renderFormattedDate } from "../datetime";

type TTranslate = (key: string, params?: Record<string, unknown>) => string;

/** Keys of the error payload that carry data, not a message. */
const SUBTASK_ERROR_DATA_KEYS = new Set([
  "error_code",
  "issue_ids",
  "parent_target_date",
  "subtask_identifiers",
  "latest_subtask_target_date",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** DRF wraps serializer error values in lists; bulk endpoints send plain values. */
const firstString = (value: unknown): string | undefined => {
  const first: unknown = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first.length > 0 ? first : undefined;
};

const isSubtaskRuleErrorCode = (value: string): value is TSubtaskRuleErrorCode =>
  (SUBTASK_RULE_ERROR_CODES as readonly string[]).includes(value);

/**
 * Reads `error_code` from an API error body. It is a list on serializer errors
 * (`{"error_code": ["CODE"]}`) and a plain string on the bulk endpoints.
 */
export const getSubtaskRuleErrorCode = (error: unknown): TSubtaskRuleErrorCode | undefined => {
  if (!isRecord(error)) return undefined;
  const code = firstString(error.error_code);
  return code && isSubtaskRuleErrorCode(code) ? code : undefined;
};

/** First human-readable message in an API error body (`error`, then the first field message). */
const getFirstErrorMessage = (error: Record<string, unknown>): string | undefined => {
  const bulkMessage = firstString(error.error);
  if (bulkMessage) return bulkMessage;
  for (const [key, value] of Object.entries(error)) {
    if (SUBTASK_ERROR_DATA_KEYS.has(key)) continue;
    const message = firstString(value);
    if (message) return message;
  }
  return undefined;
};

const getStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/**
 * Toast message for a subtask-rule error from the API, or `undefined` when the error is not one
 * (no `error_code`), so callers keep their own generic message.
 * Known codes map to `sub_work_item.errors.<code_lowercase>`; an unknown code falls back to the
 * first field message of the body.
 */
export const getSubtaskRuleError = (error: unknown, t: TTranslate): string | undefined => {
  if (!isRecord(error) || error.error_code === undefined) return undefined;
  const code = getSubtaskRuleErrorCode(error);
  const fallback = getFirstErrorMessage(error);
  if (!code) return fallback;

  const key = `sub_work_item.errors.${code.toLowerCase()}`;
  if (code === "SUBTASK_DATE_AFTER_PARENT") {
    const rawDate = firstString(error.parent_target_date);
    // `MMM dd, yyyy`, like every other date in the UI; keep the raw value if it doesn't parse
    const date = rawDate ? (renderFormattedDate(rawDate) ?? rawDate) : undefined;
    return date ? t(key, { date }) : fallback;
  }
  if (code === "PARENT_DATE_BEFORE_SUBTASKS") {
    const items = getStringList(error.subtask_identifiers).join(", ");
    return items ? t(key, { items }) : fallback;
  }
  return t(key);
};

/**
 * How a child's state change moves its parent's `completed_sub_issues_count`:
 * +1 when it moves into the `completed` group, -1 when it moves out, 0 otherwise.
 */
export const getCompletedSubIssuesCountDelta = (
  oldGroup: TStateGroups | undefined,
  newGroup: TStateGroups | undefined
): -1 | 0 | 1 => {
  const wasCompleted = oldGroup === "completed";
  const isCompleted = newGroup === "completed";
  if (wasCompleted === isCompleted) return 0;
  return isCompleted ? 1 : -1;
};

/**
 * Applies a delta to `completed_sub_issues_count`, clamped to `[0, total]`.
 * Stays `undefined` when the count was never loaded (cards then show the total only).
 */
export const adjustCompletedSubIssuesCount = (
  current: number | undefined,
  delta: number,
  total?: number
): number | undefined => {
  if (current === undefined || current === null) return undefined;
  const next = Math.max(0, current + delta);
  return total === undefined || total === null ? next : Math.min(next, total);
};

/**
 * Applies `delta` like `adjustCompletedSubIssuesCount` and also returns the delta that actually
 * landed after clamping, so an undo can reverse exactly that change (`-applied`) on top of whatever
 * the count is by then, instead of restoring a stale absolute value.
 */
export const applyCompletedSubIssuesCountDelta = (
  current: number | undefined,
  delta: number,
  total?: number
): { next: number | undefined; applied: number } => {
  const next = adjustCompletedSubIssuesCount(current, delta, total);
  const applied = next === undefined || current === undefined || current === null ? 0 : next - current;
  return { next, applied };
};

/**
 * True when the API will auto-complete the parent: every sub-work item is completed or cancelled,
 * and at least one is completed.
 */
export const isSubtaskRollupReady = (groups: (TStateGroups | undefined)[]): boolean =>
  groups.length > 0 &&
  groups.every((group) => group === "completed" || group === "cancelled") &&
  groups.some((group) => group === "completed");

/**
 * Count-only fallback for `isSubtaskRollupReady`, used when not every sibling is loaded. Mirrors the
 * API rule: every sub-work item completed or cancelled, at least one completed. `cancelled` is the
 * number of cancelled siblings we know of (the list endpoints don't send a cancelled count).
 */
export const isSubtaskRollupReadyFromCounts = (
  total: number | undefined | null,
  completed: number | undefined | null,
  cancelled = 0
): boolean => {
  if (!total || total <= 0 || completed === undefined || completed === null || completed < 1) return false;
  return completed + Math.max(0, cancelled) >= total;
};

/**
 * One level of sub-work items only: a work item can get sub-work items unless it is one itself.
 * `false` while the work item is not loaded.
 */
export const canAddSubWorkItems = (issue: Pick<TIssue, "parent_id"> | undefined | null): boolean =>
  !!issue && !issue.parent_id;

/**
 * One level of sub-work items only: a work item can get a parent unless it has sub-work items,
 * counted by the API (`sub_issues_count`) or loaded in the sub-work items widget (`loadedSubIds`).
 */
export const canSetParent = (
  issue: Pick<TIssue, "sub_issues_count"> | undefined | null,
  loadedSubIds?: readonly string[] | null
): boolean => (issue?.sub_issues_count ?? 0) <= 0 && (loadedSubIds?.length ?? 0) === 0;

/** Card label: `done/total`, or just `total` when the completed count is not known. */
export const formatSubIssuesProgress = (total: number, completed?: number | null): string =>
  completed === undefined || completed === null ? `${total}` : `${Math.min(completed, total)}/${total}`;
