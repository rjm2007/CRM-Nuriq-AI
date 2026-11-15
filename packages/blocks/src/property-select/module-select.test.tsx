/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModuleSelect } from "./module-select";

const modules = [
  { id: "core", name: "Core workflow" },
  { id: "onboarding", name: "Onboarding flow" },
];

const renderMulti = (variant: "select-ghost-md" | "table-cell") =>
  render(
    <ModuleSelect
      multiple
      getValues={() => Promise.resolve({ results: [] })}
      value={modules}
      onChange={vi.fn()}
      variant={variant}
    />
  );

describe("ModuleSelect multi-select pills", () => {
  it("lists each selected module as a 24px badge, matching the label pills", () => {
    renderMulti("select-ghost-md");
    for (const module of modules) {
      const pill = screen.getByText(module.name).closest('[data-slot="module-pill"]');
      if (!(pill instanceof HTMLElement)) throw new Error("module pill not rendered");
      expect(pill.tagName).toBe("SPAN");
      expect(pill.className).toContain("h-(--control-height-sm)");
      expect(pill.className).toContain("bg-layer-3");
      expect(pill.querySelector("svg")).not.toBeNull();
    }
  });

  it("summarises the selection as a count in a table cell", () => {
    renderMulti("table-cell");
    expect(screen.getByText("2 modules")).toBeTruthy();
    expect(document.querySelector('[data-slot="module-pill"]')).toBeNull();
  });
});

// Neuric (Step 2): the phases settings picker shows each keyword's current phase as a second line.
describe("ModuleSelect option description", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true });
  });

  afterEach(async () => {
    cleanup();
    try {
      await act(() => vi.runOnlyPendingTimersAsync());
    } finally {
      vi.useRealTimers();
    }
  });

  const options = [
    { id: "core", name: "Core workflow", description: "Phase: Build" },
    { id: "onboarding", name: "Onboarding flow" },
  ];

  const renderPicker = (showDescription: boolean) =>
    render(
      <ModuleSelect
        multiple
        getValues={() => Promise.resolve({ results: options, next_page_results: false })}
        value={[]}
        onChange={vi.fn()}
        variant="pill-sm"
        placeholder="Add keywords"
        showDescription={showDescription}
      />
    );

  it("renders the description under the option name when showDescription is set", async () => {
    const user = userEvent.setup();
    renderPicker(true);
    await user.click(screen.getByRole("button", { name: /Add keywords/ }));
    const row = await within(document.body).findByRole("option", { name: /Core workflow/ });
    expect(within(row).getByText("Phase: Build")).toBeDefined();
  });

  it("keeps rows single-line without showDescription", async () => {
    const user = userEvent.setup();
    renderPicker(false);
    await user.click(screen.getByRole("button", { name: /Add keywords/ }));
    await within(document.body).findByRole("option", { name: /Core workflow/ });
    expect(within(document.body).queryByText("Phase: Build")).toBeNull();
  });
});
