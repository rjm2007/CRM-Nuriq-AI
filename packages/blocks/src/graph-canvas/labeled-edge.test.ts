/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { getSameSidePath } from "./labeled-edge";

describe("getSameSidePath", () => {
  it("bows out to the right of both ends and puts the label on the curve's midpoint", () => {
    const [path, labelX, labelY] = getSameSidePath(100, 0, 100, 200);
    expect(path).toBe("M 100,0 C 198,0 198,200 100,200");
    expect(labelX).toBeCloseTo(100 + 0.75 * 98);
    expect(labelY).toBe(100);
  });

  it("bows further for nodes that are far apart", () => {
    expect(getSameSidePath(0, 0, 0, 800)[1]).toBeGreaterThan(getSameSidePath(0, 0, 0, 80)[1]);
  });
});
