/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * Neuric: subtask rules (one level of sub-work items, due date capped by the parent).
 * Mirrors `apps/api/plane/utils/subtask_rules.py` and `apps/api/plane/bgtasks/subtask_rollup_task.py`.
 */

/** `error_code` values the API returns when a subtask rule is broken (400). */
export const SUBTASK_RULE_ERROR_CODES = [
  "SUBTASK_SELF_PARENT",
  "SUBTASK_PARENT_IS_SUBTASK",
  "SUBTASK_HAS_CHILDREN",
  "SUBTASK_DATE_AFTER_PARENT",
  "PARENT_DATE_BEFORE_SUBTASKS",
] as const;

export type TSubtaskRuleErrorCode = (typeof SUBTASK_RULE_ERROR_CODES)[number];

/**
 * Comment on the `state` activity the API logs when a parent is auto-completed because all of its
 * sub-work items are done. Must equal `SUBTASK_ROLLUP_COMMENT` in `bgtasks/subtask_rollup_task.py`.
 */
export const SUBTASK_ROLLUP_COMMENT = "updated the state to (all sub-work items are done)";

/** Delay before re-fetching a parent after its last sub-work item is closed (the API rolls up in Celery). */
export const SUBTASK_ROLLUP_REFETCH_DELAY_MS = 1500;
