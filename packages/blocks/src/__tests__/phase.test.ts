/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: unit tests for the phase helpers in @plane/utils (src/phase.ts), Step 2.
// They live here because @plane/utils has no test runner; @plane/blocks already depends on it.
import { describe, expect, it } from "vitest";
import { PHASE_SEQUENCE_GAP } from "@plane/constants";
import {
  getPhaseActivityKind,
  getPhaseDropSequence,
  getPhaseKeywordSpan,
  isKeywordOutsidePhaseDates,
} from "@plane/utils";

const phases = [
  { id: "a", sequence: 0 },
  { id: "b", sequence: 100 },
  { id: "c", sequence: 300 },
];

describe("getPhaseDropSequence", () => {
  it("takes the midpoint to the neighbour", () => {
    expect(getPhaseDropSequence(phases, "b", "top")).toBe(50);
    expect(getPhaseDropSequence(phases, "b", "bottom")).toBe(200);
  });

  it("goes one gap past the first or last phase", () => {
    expect(getPhaseDropSequence(phases, "a", "top")).toBe(-PHASE_SEQUENCE_GAP);
    expect(getPhaseDropSequence(phases, "c", "bottom")).toBe(300 + PHASE_SEQUENCE_GAP);
  });

  it("treats a sequence of 0 as a real value", () => {
    expect(getPhaseDropSequence(phases, "a", "bottom")).toBe(50);
  });

  it("gives undefined without an edge or for an unknown target", () => {
    expect(getPhaseDropSequence(phases, "b", null)).toBeUndefined();
    expect(getPhaseDropSequence(phases, "x", "top")).toBeUndefined();
  });
});

describe("getPhaseKeywordSpan", () => {
  it("takes the earliest start and the latest target", () => {
    expect(
      getPhaseKeywordSpan([
        { start_date: "2026-03-01", target_date: "2026-03-20" },
        { start_date: "2026-02-10", target_date: null },
        { start_date: null, target_date: "2026-04-02T00:00:00Z" },
      ])
    ).toEqual({ start_date: "2026-02-10", target_date: "2026-04-02" });
  });

  it("is empty when no keyword has dates", () => {
    expect(getPhaseKeywordSpan([])).toEqual({ start_date: null, target_date: null });
    expect(getPhaseKeywordSpan([{ start_date: null, target_date: undefined }])).toEqual({
      start_date: null,
      target_date: null,
    });
  });
});

describe("isKeywordOutsidePhaseDates", () => {
  const phase = { start_date: "2026-03-01", target_date: "2026-03-31" };

  it("is false inside the phase, including the boundary days", () => {
    expect(isKeywordOutsidePhaseDates(phase, { start_date: "2026-03-01", target_date: "2026-03-31" })).toBe(false);
  });

  it("flags a start before the phase or a target after it", () => {
    expect(isKeywordOutsidePhaseDates(phase, { start_date: "2026-02-28", target_date: "2026-03-10" })).toBe(true);
    expect(isKeywordOutsidePhaseDates(phase, { start_date: "2026-03-10", target_date: "2026-04-01" })).toBe(true);
  });

  it("only compares dates set on both sides", () => {
    expect(isKeywordOutsidePhaseDates(phase, { start_date: null, target_date: null })).toBe(false);
    expect(isKeywordOutsidePhaseDates({ start_date: null, target_date: null }, { start_date: "2020-01-01" })).toBe(
      false
    );
    expect(
      isKeywordOutsidePhaseDates({ start_date: "2026-03-01", target_date: null }, { target_date: "2026-02-01" })
    ).toBe(true);
  });
});

describe("getPhaseActivityKind", () => {
  it("reads the old / new phase names", () => {
    expect(getPhaseActivityKind({ old_value: "Design", new_value: "Build" })).toBe("moved");
    expect(getPhaseActivityKind({ old_value: null, new_value: "Build" })).toBe("added");
    expect(getPhaseActivityKind({ old_value: "Design", new_value: "" })).toBe("removed");
    expect(getPhaseActivityKind({})).toBeUndefined();
  });
});
