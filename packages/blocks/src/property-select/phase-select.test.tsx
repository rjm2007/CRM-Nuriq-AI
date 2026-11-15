/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhaseSelect } from "./phase-select";
import type { PhaseOption } from "./phase-select";

const PHASES: PhaseOption[] = [
  { id: "discovery", name: "Discovery" },
  { id: "build", name: "Build" },
];

const popup = () => within(document.body);

describe("PhaseSelect", () => {
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

  it("shows the placeholder when nothing is selected", () => {
    render(<PhaseSelect options={PHASES} value={null} onChange={vi.fn()} variant="select-lg" placeholder="Phase" />);
    expect(screen.getByRole("button", { name: /Phase/ })).toBeDefined();
  });

  it("names the selected phase on the trigger", () => {
    render(<PhaseSelect options={PHASES} value="build" onChange={vi.fn()} variant="select-lg" placeholder="Phase" />);
    expect(screen.getByRole("button", { name: /Build/ })).toBeDefined();
  });

  it("shows the missing label when the selected id is not among the options", () => {
    render(
      <PhaseSelect
        options={PHASES}
        value="gone"
        onChange={vi.fn()}
        variant="select-lg"
        placeholder="Phase"
        missingLabel="Phase unavailable"
      />
    );
    const button = screen.getByRole("button", { name: /Phase unavailable/ });
    expect(button.querySelector('[data-missing="true"]')).not.toBeNull();
  });

  it("lists the phases in the given order and emits the picked id", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PhaseSelect options={PHASES} value={null} onChange={onChange} variant="select-lg" placeholder="Phase" />);

    await user.click(screen.getByRole("button", { name: /Phase/ }));
    const options = await popup().findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Discovery", "Build"]);
    await user.click(popup().getByRole("option", { name: /Build/ }));
    expect(onChange).toHaveBeenCalledWith("build");
  });

  it("is named by a form label through `id`", () => {
    render(
      <>
        <label htmlFor="keyword-phase">Phase</label>
        <PhaseSelect options={PHASES} value="build" onChange={vi.fn()} variant="select-lg" id="keyword-phase" />
      </>
    );
    const trigger = screen.getByLabelText("Phase");
    expect(trigger.id).toBe("keyword-phase");
    expect(trigger.tagName).toBe("BUTTON");
  });

  it("emits null from the clear row when clearable", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PhaseSelect
        options={PHASES}
        value="build"
        onChange={onChange}
        variant="select-lg"
        placeholder="Phase"
        clearable
        clearLabel="No phase"
      />
    );

    await user.click(screen.getByRole("button", { name: /Build/ }));
    await user.click(await popup().findByRole("option", { name: /No phase/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("has no clear row unless clearable", async () => {
    const user = userEvent.setup();
    render(
      <PhaseSelect
        options={PHASES}
        value="build"
        onChange={vi.fn()}
        variant="select-lg"
        placeholder="Phase"
        clearLabel="No phase"
      />
    );

    await user.click(screen.getByRole("button", { name: /Build/ }));
    await popup().findByRole("option", { name: /Discovery/ });
    expect(popup().queryByRole("option", { name: /No phase/ })).toBeNull();
  });

  it("does not open when disabled", async () => {
    const user = userEvent.setup();
    render(
      <PhaseSelect options={PHASES} value="build" onChange={vi.fn()} variant="select-lg" placeholder="Phase" disabled />
    );

    await user.click(screen.getByRole("button", { name: /Build/ }));
    expect(popup().queryByRole("option", { name: /Discovery/ })).toBeNull();
  });
});
