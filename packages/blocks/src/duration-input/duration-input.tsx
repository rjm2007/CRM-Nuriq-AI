/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { InputField } from "@makeplane/propel/components/input-field";
import type { InputSize } from "@makeplane/propel/components/input-field";
import { WORKLOG_MAX_MINUTES, WORKLOG_MIN_MINUTES, formatWorkLogDuration, parseWorkLogDuration } from "@plane/utils";

export type DurationInputProps = {
  /** Input id, for an outside `<label htmlFor>` and e2e selectors. */
  id: string;
  /** Duration in minutes, or `undefined` when empty / not valid yet. Controlled. */
  value: number | undefined;
  /** Emits the parsed minutes on blur (and on Enter), or `undefined` when empty or invalid. */
  onChange: (minutes: number | undefined) => void;
  /** Visible label. When omitted, pass `aria-label`. */
  label?: string;
  "aria-label"?: string;
  placeholder?: string;
  /** Helper text under the field, replaced by the error when there is one. */
  hint?: string;
  /** Inline error shown when the typed text can't be parsed or is out of range. */
  invalidMessage: string;
  /** Error coming from outside (e.g. "required" on submit); the parse error wins. */
  error?: string;
  /** Allowed range in minutes. Defaults to one time entry: 1..1440. */
  min?: number;
  max?: number;
  required?: boolean;
  disabled?: boolean;
  size?: InputSize;
  className?: string;
};

const toText = (minutes: number | undefined) => (minutes === undefined ? "" : formatWorkLogDuration(minutes));

/**
 * Text field for a duration ("1h 30m", "1:30", "90m", "1.5h", "90"). Free typing; the text is
 * parsed on blur or Enter and normalised to "1h 30m". Invalid text keeps what the user typed,
 * shows `invalidMessage` inline (`aria-invalid`) and emits `undefined`.
 */
export function DurationInput(props: DurationInputProps) {
  const {
    id,
    value,
    onChange,
    label,
    placeholder,
    hint,
    invalidMessage,
    error,
    min = WORKLOG_MIN_MINUTES,
    max = WORKLOG_MAX_MINUTES,
    required,
    disabled,
    size = "lg",
    className,
  } = props;
  // states
  const [text, setText] = useState(() => toText(value));
  const [parseError, setParseError] = useState(false);
  // refs
  const isEditingRef = useRef(false);
  /** Last value this field emitted, so the echo from the parent doesn't overwrite the text. */
  const lastEmittedRef = useRef<number | undefined>(value);

  // Follow outside value changes (form reset, edit another entry) unless the user is typing.
  useEffect(() => {
    if (isEditingRef.current || value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    setText(toText(value));
    setParseError(false);
  }, [value]);

  const emit = (minutes: number | undefined) => {
    lastEmittedRef.current = minutes;
    if (minutes !== value) onChange(minutes);
  };

  const commit = () => {
    isEditingRef.current = false;
    const trimmed = text.trim();
    if (!trimmed) {
      setParseError(false);
      emit(undefined);
      return;
    }
    const minutes = parseWorkLogDuration(trimmed);
    if (minutes === undefined || minutes < min || minutes > max) {
      setParseError(true);
      lastEmittedRef.current = undefined;
      onChange(undefined);
      return;
    }
    setParseError(false);
    setText(formatWorkLogDuration(minutes));
    emit(minutes);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    // Commit first; the parent form submits on the next Enter, when its state has the new value.
    event.preventDefault();
    commit();
  };

  const shownError = parseError ? invalidMessage : error;

  return (
    <div className={className}>
      <InputField
        size={size}
        orientation="vertical"
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        label={label}
        aria-label={label ? undefined : props["aria-label"]}
        aria-invalid={shownError ? true : undefined}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        hint={hint}
        error={shownError}
        onChange={(event) => {
          isEditingRef.current = true;
          setText(event.target.value);
          if (parseError) setParseError(false);
        }}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

DurationInput.displayName = "blocks.DurationInput";
