/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DurationInput } from "./duration-input";
import type { DurationInputProps } from "./duration-input";

const INVALID = "Enter a duration between 1 minute and 24 hours.";

function Controlled(props: Partial<DurationInputProps> & { onValue?: (minutes: number | undefined) => void }) {
  const { onValue, ...rest } = props;
  const [value, setValue] = useState<number | undefined>(rest.value);
  return (
    <DurationInput
      id="duration"
      label="Duration"
      invalidMessage={INVALID}
      {...rest}
      value={value}
      onChange={(minutes) => {
        setValue(minutes);
        onValue?.(minutes);
      }}
    />
  );
}

const input = () => screen.getByRole("textbox", { name: /Duration/ });

describe("DurationInput", () => {
  it("renders a labelled textbox with the id and the formatted value", () => {
    render(<Controlled value={90} />);
    expect(input().getAttribute("id")).toBe("duration");
    expect((input() as HTMLInputElement).value).toBe("1h 30m");
    expect(input().getAttribute("aria-invalid")).toBeNull();
  });

  it("parses on blur, emits minutes and normalises the text", async () => {
    const onValue = vi.fn();
    render(<Controlled onValue={onValue} />);
    const user = userEvent.setup();
    await user.type(input(), "1:30");
    expect(onValue).not.toHaveBeenCalled();
    await user.tab();
    expect(onValue).toHaveBeenLastCalledWith(90);
    expect((input() as HTMLInputElement).value).toBe("1h 30m");
  });

  it("commits on Enter and then submits the surrounding form with the new value", async () => {
    const onSubmitValue = vi.fn();
    function FormHarness() {
      const [value, setValue] = useState<number | undefined>(undefined);
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitValue(value);
          }}
        >
          <DurationInput id="duration" label="Duration" invalidMessage={INVALID} value={value} onChange={setValue} />
        </form>
      );
    }
    render(<FormHarness />);
    const user = userEvent.setup();
    await user.type(input(), "1.5h{Enter}");
    await vi.waitFor(() => expect(onSubmitValue).toHaveBeenCalledTimes(1));
    expect(onSubmitValue).toHaveBeenLastCalledWith(90);
  });

  it("does not submit the form on Enter when the text is invalid", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Controlled />
      </form>
    );
    const user = userEvent.setup();
    await user.type(input(), "abc{Enter}");
    await Promise.resolve();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input().getAttribute("aria-invalid")).toBe("true");
  });

  it("shows an inline error with aria-invalid for text it can't parse, and emits undefined", async () => {
    const onValue = vi.fn();
    render(<Controlled value={30} onValue={onValue} />);
    const user = userEvent.setup();
    await user.clear(input());
    await user.type(input(), "abc");
    await user.tab();
    expect(onValue).toHaveBeenLastCalledWith(undefined);
    expect(input().getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(INVALID)).toBeTruthy();
    expect((input() as HTMLInputElement).value).toBe("abc");
  });

  it("rejects durations outside the range (over 24h by default)", async () => {
    const onValue = vi.fn();
    render(<Controlled onValue={onValue} />);
    const user = userEvent.setup();
    await user.type(input(), "25h");
    await user.tab();
    expect(onValue).toHaveBeenLastCalledWith(undefined);
    expect(screen.getByText(INVALID)).toBeTruthy();
  });

  it("clears the error once the user types again", async () => {
    render(<Controlled />);
    const user = userEvent.setup();
    await user.type(input(), "x");
    await user.tab();
    expect(screen.queryByText(INVALID)).toBeTruthy();
    await user.type(input(), "{Backspace}45m");
    expect(screen.queryByText(INVALID)).toBeNull();
    await user.tab();
    expect((input() as HTMLInputElement).value).toBe("45m");
  });

  it("shows an outside error when the text is valid", () => {
    render(<Controlled error="Duration is required" />);
    expect(screen.getByText("Duration is required")).toBeTruthy();
    expect(input().getAttribute("aria-invalid")).toBe("true");
  });

  it("follows a new value from the parent", () => {
    const { rerender } = render(
      <DurationInput id="d" label="Duration" invalidMessage={INVALID} value={60} onChange={() => {}} />
    );
    expect((input() as HTMLInputElement).value).toBe("1h");
    rerender(<DurationInput id="d" label="Duration" invalidMessage={INVALID} value={15} onChange={() => {}} />);
    expect((input() as HTMLInputElement).value).toBe("15m");
  });
});
