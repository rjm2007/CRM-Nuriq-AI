/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: unit tests for the subtask-rule helpers in @plane/utils (src/work-item/subtask-rules.ts).
// They live here because @plane/utils has no test runner; @plane/blocks already depends on it.
import { describe, expect, it } from "vitest";
import { SUBTASK_ROLLUP_COMMENT, SUBTASK_RULE_ERROR_CODES } from "@plane/constants";
import {
  adjustCompletedSubIssuesCount,
  formatSubIssuesProgress,
  getCompletedSubIssuesCountDelta,
  getSubtaskRuleError,
  getSubtaskRuleErrorCode,
  isSubtaskRollupReady,
} from "@plane/utils";

/** Fake `t`: returns the key plus its params so the test can see both. */
const t = (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key);

describe("getSubtaskRuleErrorCode", () => {
  it("reads a list (serializer errors) and a plain string (bulk endpoints)", () => {
    expect(getSubtaskRuleErrorCode({ parent_id: ["msg"], error_code: ["SUBTASK_HAS_CHILDREN"] })).toBe(
      "SUBTASK_HAS_CHILDREN"
    );
    expect(getSubtaskRuleErrorCode({ error: "msg", error_code: "SUBTASK_SELF_PARENT", issue_ids: ["1"] })).toBe(
      "SUBTASK_SELF_PARENT"
    );
  });

  it("ignores unknown codes and non-objects", () => {
    expect(getSubtaskRuleErrorCode({ error_code: ["SOMETHING_ELSE"] })).toBeUndefined();
    expect(getSubtaskRuleErrorCode(undefined)).toBeUndefined();
    expect(getSubtaskRuleErrorCode("boom")).toBeUndefined();
    expect(getSubtaskRuleErrorCode(["SUBTASK_SELF_PARENT"])).toBeUndefined();
  });
});

describe("getSubtaskRuleError", () => {
  it("maps every backend code to an i18n key", () => {
    expect(getSubtaskRuleError({ parent_id: ["x"], error_code: ["SUBTASK_SELF_PARENT"] }, t)).toBe(
      "sub_work_item.errors.subtask_self_parent"
    );
    expect(getSubtaskRuleError({ parent_id: ["x"], error_code: ["SUBTASK_PARENT_IS_SUBTASK"] }, t)).toBe(
      "sub_work_item.errors.subtask_parent_is_subtask"
    );
    expect(getSubtaskRuleError({ error: "x", error_code: "SUBTASK_HAS_CHILDREN", issue_ids: ["a"] }, t)).toBe(
      "sub_work_item.errors.subtask_has_children"
    );
    expect(SUBTASK_RULE_ERROR_CODES).toHaveLength(5);
  });

  it("passes the parent's date for SUBTASK_DATE_AFTER_PARENT (list or plain value)", () => {
    const serializerError = {
      target_date: ["A sub-work item's due date cannot be after its parent's due date (2026-11-20)."],
      error_code: ["SUBTASK_DATE_AFTER_PARENT"],
      parent_target_date: ["2026-11-20"],
    };
    expect(getSubtaskRuleError(serializerError, t)).toBe(
      'sub_work_item.errors.subtask_date_after_parent {"date":"2026-11-20"}'
    );
    const bulkError = {
      error: "Some work items are due after the parent's due date (2026-11-20).",
      error_code: "SUBTASK_DATE_AFTER_PARENT",
      issue_ids: ["a"],
      parent_target_date: "2026-11-20",
    };
    expect(getSubtaskRuleError(bulkError, t)).toBe(
      'sub_work_item.errors.subtask_date_after_parent {"date":"2026-11-20"}'
    );
  });

  it("lists the blocking subtasks for PARENT_DATE_BEFORE_SUBTASKS", () => {
    const error = {
      target_date: ["The due date cannot be before the due date of its sub-work items (PROJ-12, PROJ-13)."],
      error_code: ["PARENT_DATE_BEFORE_SUBTASKS"],
      subtask_identifiers: ["PROJ-12", "PROJ-13"],
      latest_subtask_target_date: ["2026-12-01"],
    };
    expect(getSubtaskRuleError(error, t)).toBe(
      'sub_work_item.errors.parent_date_before_subtasks {"items":"PROJ-12, PROJ-13"}'
    );
  });

  it("falls back to the first field message when the code is unknown or details are missing", () => {
    expect(getSubtaskRuleError({ parent_id: ["Server says no"], error_code: ["NEW_CODE"] }, t)).toBe("Server says no");
    expect(getSubtaskRuleError({ error: "Bulk says no", error_code: "NEW_CODE", issue_ids: ["a"] }, t)).toBe(
      "Bulk says no"
    );
    expect(getSubtaskRuleError({ target_date: ["Too late"], error_code: ["SUBTASK_DATE_AFTER_PARENT"] }, t)).toBe(
      "Too late"
    );
  });

  it("returns undefined for errors that are not subtask-rule errors", () => {
    expect(getSubtaskRuleError({ name: ["This field is required."] }, t)).toBeUndefined();
    expect(getSubtaskRuleError({ error: "Something went wrong" }, t)).toBeUndefined();
    expect(getSubtaskRuleError(undefined, t)).toBeUndefined();
    expect(getSubtaskRuleError(new Error("network"), t)).toBeUndefined();
  });
});

describe("completed sub-work item count", () => {
  it("moves by one only when the completed group is crossed", () => {
    expect(getCompletedSubIssuesCountDelta("started", "completed")).toBe(1);
    expect(getCompletedSubIssuesCountDelta("completed", "started")).toBe(-1);
    expect(getCompletedSubIssuesCountDelta("completed", "cancelled")).toBe(-1);
    expect(getCompletedSubIssuesCountDelta("cancelled", "completed")).toBe(1);
    expect(getCompletedSubIssuesCountDelta("backlog", "started")).toBe(0);
    expect(getCompletedSubIssuesCountDelta("started", "cancelled")).toBe(0);
    expect(getCompletedSubIssuesCountDelta("completed", "completed")).toBe(0);
    expect(getCompletedSubIssuesCountDelta(undefined, undefined)).toBe(0);
  });

  it("adjusts and clamps to [0, total], keeps undefined when never loaded", () => {
    expect(adjustCompletedSubIssuesCount(2, 1, 5)).toBe(3);
    expect(adjustCompletedSubIssuesCount(5, 1, 5)).toBe(5);
    expect(adjustCompletedSubIssuesCount(0, -1, 5)).toBe(0);
    expect(adjustCompletedSubIssuesCount(1, -1)).toBe(0);
    expect(adjustCompletedSubIssuesCount(undefined, 1, 5)).toBeUndefined();
  });

  it("formats done/total and falls back to the total", () => {
    expect(formatSubIssuesProgress(5, 3)).toBe("3/5");
    expect(formatSubIssuesProgress(5, 0)).toBe("0/5");
    expect(formatSubIssuesProgress(5, undefined)).toBe("5");
    expect(formatSubIssuesProgress(5, null)).toBe("5");
    expect(formatSubIssuesProgress(2, 4)).toBe("2/2");
  });
});

describe("isSubtaskRollupReady", () => {
  it("needs every sibling completed or cancelled, with at least one completed", () => {
    expect(isSubtaskRollupReady(["completed", "completed"])).toBe(true);
    expect(isSubtaskRollupReady(["completed", "cancelled"])).toBe(true);
    expect(isSubtaskRollupReady(["cancelled", "cancelled"])).toBe(false);
    expect(isSubtaskRollupReady(["completed", "started"])).toBe(false);
    expect(isSubtaskRollupReady(["completed", undefined])).toBe(false);
    expect(isSubtaskRollupReady([])).toBe(false);
  });
});

describe("SUBTASK_ROLLUP_COMMENT", () => {
  it("matches the backend constant in bgtasks/subtask_rollup_task.py", () => {
    expect(SUBTASK_ROLLUP_COMMENT).toBe("updated the state to (all sub-work items are done)");
  });
});
