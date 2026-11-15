/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageSelect } from "./page-select";
import type { PageOption } from "./page-select";

const PAGES: PageOption[] = [
  { id: "spec", name: "Product spec" },
  { id: "notes", name: "Meeting notes" },
];

const popup = () => within(document.body);

describe("PageSelect", () => {
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
    render(<PageSelect options={PAGES} value={null} onChange={vi.fn()} variant="select-lg" placeholder="PRD page" />);
    expect(screen.getByRole("button", { name: /PRD page/ })).toBeDefined();
  });

  it("names the selected page on the trigger", () => {
    render(<PageSelect options={PAGES} value="notes" onChange={vi.fn()} variant="select-lg" placeholder="PRD page" />);
    expect(screen.getByRole("button", { name: /Meeting notes/ })).toBeDefined();
  });

  it("shows the missing label when the selected id is not among the options", () => {
    render(
      <PageSelect
        options={PAGES}
        value="gone"
        onChange={vi.fn()}
        variant="select-lg"
        placeholder="PRD page"
        missingLabel="Page unavailable"
      />
    );
    const button = screen.getByRole("button", { name: /Page unavailable/ });
    expect(button.querySelector('[data-missing="true"]')).not.toBeNull();
  });

  it("emits the picked page id", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PageSelect options={PAGES} value={null} onChange={onChange} variant="select-lg" placeholder="PRD page" />);

    await user.click(screen.getByRole("button", { name: /PRD page/ }));
    await user.click(await popup().findByRole("option", { name: /Product spec/ }));
    expect(onChange).toHaveBeenCalledWith("spec");
  });
});
