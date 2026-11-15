/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: unit tests for the time tracking helpers in @plane/utils (src/work-item/worklog.ts).
// They live here because @plane/utils has no test runner; @plane/blocks already depends on it.
import { describe, expect, it } from "vitest";
import {
  canLogWork,
  canManageWorkLog,
  formatWorkLogDuration,
  getWorkLogErrorCode,
  isValidWorkLogDuration,
  parseWorkLogDuration,
} from "@plane/utils";

describe("formatWorkLogDuration", () => {
  it("formats hours and minutes", () => {
    expect(formatWorkLogDuration(90)).toBe("1h 30m");
    expect(formatWorkLogDuration(60)).toBe("1h");
    expect(formatWorkLogDuration(45)).toBe("45m");
    expect(formatWorkLogDuration(1440)).toBe("24h");
    expect(formatWorkLogDuration(3001)).toBe("50h 1m");
  });

  it("gives 0m for empty, zero, negative or non-finite input", () => {
    expect(formatWorkLogDuration(0)).toBe("0m");
    expect(formatWorkLogDuration(-5)).toBe("0m");
    expect(formatWorkLogDuration(undefined)).toBe("0m");
    expect(formatWorkLogDuration(null)).toBe("0m");
    expect(formatWorkLogDuration(Number.NaN)).toBe("0m");
  });

  it("rounds to whole minutes", () => {
    expect(formatWorkLogDuration(89.6)).toBe("1h 30m");
  });
});

describe("parseWorkLogDuration", () => {
  it.each([
    ["1h 30m", 90],
    ["1h30m", 90],
    ["1h30", 90],
    ["1:30", 90],
    ["0:05", 5],
    ["90m", 90],
    ["90 min", 90],
    ["90", 90],
    ["1.5h", 90],
    ["1,5h", 90],
    ["2h", 120],
    ["2 hours 5 mins", 125],
    ["  1H 30M  ", 90],
    ["0.25h", 15],
  ])("parses %s as %i minutes", (input, expected) => {
    expect(parseWorkLogDuration(input)).toBe(expected);
  });

  it.each(["", "   ", "abc", "1:75", "1:5", "1.5", "h", "m", "-30", "1h 30x", "1:30:00"])(
    "returns undefined for %j",
    (input) => {
      expect(parseWorkLogDuration(input)).toBeUndefined();
    }
  );

  it("handles null and undefined", () => {
    expect(parseWorkLogDuration(undefined)).toBeUndefined();
    expect(parseWorkLogDuration(null)).toBeUndefined();
  });

  it("round-trips with formatWorkLogDuration", () => {
    for (const minutes of [1, 15, 59, 60, 61, 90, 600, 1440]) {
      expect(parseWorkLogDuration(formatWorkLogDuration(minutes))).toBe(minutes);
    }
  });
});

describe("isValidWorkLogDuration", () => {
  it("accepts whole minutes in 1..1440", () => {
    expect(isValidWorkLogDuration(1)).toBe(true);
    expect(isValidWorkLogDuration(1440)).toBe(true);
    expect(isValidWorkLogDuration(0)).toBe(false);
    expect(isValidWorkLogDuration(1441)).toBe(false);
    expect(isValidWorkLogDuration(1.5)).toBe(false);
    expect(isValidWorkLogDuration(undefined)).toBe(false);
  });
});

describe("getWorkLogErrorCode", () => {
  it("reads a string or a list error_code", () => {
    expect(getWorkLogErrorCode({ error: "off", error_code: "TIME_TRACKING_DISABLED" })).toBe("TIME_TRACKING_DISABLED");
    expect(getWorkLogErrorCode({ user: ["msg"], error_code: ["INVALID_WORKLOG_USER"] })).toBe("INVALID_WORKLOG_USER");
  });

  it("ignores unknown codes and non-objects", () => {
    expect(getWorkLogErrorCode({ error_code: "SUBTASK_HAS_CHILDREN" })).toBeUndefined();
    expect(getWorkLogErrorCode({ error: "x" })).toBeUndefined();
    expect(getWorkLogErrorCode(undefined)).toBeUndefined();
    expect(getWorkLogErrorCode("TIME_TRACKING_DISABLED")).toBeUndefined();
  });
});

describe("canLogWork / canManageWorkLog", () => {
  it("lets admins and members log, not guests", () => {
    expect(canLogWork(20)).toBe(true);
    expect(canLogWork(15)).toBe(true);
    expect(canLogWork(5)).toBe(false);
    expect(canLogWork(undefined)).toBe(false);
  });

  it("members manage only their own entries; admins manage any", () => {
    const entry = { user: "u1" };
    expect(canManageWorkLog(entry, "u1", 15)).toBe(true);
    expect(canManageWorkLog(entry, "u2", 15)).toBe(false);
    expect(canManageWorkLog(entry, "u2", 20)).toBe(true);
    expect(canManageWorkLog(entry, "u1", 5)).toBe(false);
    expect(canManageWorkLog(entry, undefined, 15)).toBe(false);
  });
});
