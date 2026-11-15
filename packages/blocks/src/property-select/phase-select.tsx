/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import type { ReactNode } from "react";
import type { ComboboxContentSizing } from "@makeplane/propel/components/combobox";
import { MilestoneOutline } from "@makeplane/propel/icons";
import { Select } from "../select/select";
import type { SelectTooltip, SelectVariant } from "../select/types";

/** Id for the clear row — an empty string maps back to `null` via `id || null` (same as `CycleSelect`). */
const CLEAR_OPTION_ID = "";

/** Minimal phase shape the dropdown needs — the client maps its phase store record down to this. */
export type PhaseOption = {
  id: string;
  name: string;
};

export type PhaseSelectProps = {
  /** Phases of the project, already in phase order (the list keeps the given order). */
  options: PhaseOption[];
  /** Selected phase id, or `null` when none. */
  value: string | null | undefined;
  /** Emits the picked phase id, or `null` when the selection is cleared (the `clearable` row). */
  onChange: (id: string | null) => void;
  /** Controls trigger chrome, button sizing, and arrow visibility. */
  variant: SelectVariant;
  disabled?: boolean;
  /** Trigger text while nothing is selected. */
  placeholder?: string;
  searchPlaceholder?: string;
  /** Trigger text when `value` is set but no option matches it (phase deleted or not loaded). */
  missingLabel?: string;
  /** Row shown when `options` is empty or nothing matches the search. */
  emptyMessage?: ReactNode;
  onClose?: () => void;
  className?: string;
  tooltip?: SelectTooltip;
  /** Forwarded to the trigger as `data-testid` — value-agnostic e2e selector. */
  testId?: string;
  /** Tab order of the trigger, for forms that sequence focus explicitly. */
  tabIndex?: number;
  /** DOM id of the trigger, so a form `<label htmlFor>` names and focuses it. */
  id?: string;
  /** Pins a clear row to the top of the list; picking it emits `null`. Defaults to `false`. */
  clearable?: boolean;
  /** Label for the clear row. Defaults to `placeholder`. */
  clearLabel?: string;
  /** Dropdown width: `auto` (default) hugs the content, `anchor` matches the trigger. */
  contentSizing?: ComboboxContentSizing;
};

/**
 * Neuric: presentational single phase picker (a keyword's phase), built on the generic `Select` (sync mode)
 * like `PageSelect`. The client passes the project's phases in as `options` and maps `onChange` to its own
 * assign / remove calls; this block owns only the phase-specific markup.
 */
export function PhaseSelect(props: PhaseSelectProps) {
  const {
    options,
    value,
    onChange,
    variant,
    disabled = false,
    placeholder = "",
    searchPlaceholder = "Search phases...",
    missingLabel,
    emptyMessage,
    onClose,
    className,
    tooltip,
    testId,
    tabIndex,
    id: triggerId,
    clearable = false,
    clearLabel,
    contentSizing,
  } = props;

  const selected = value ? (options.find((phase) => phase.id === value) ?? null) : null;
  const isMissing = !!value && !selected;
  const emptyLabel = isMissing && missingLabel ? missingLabel : placeholder;
  const resolvedClearLabel = clearLabel ?? placeholder;
  const clearOption = useMemo<PhaseOption>(
    () => ({ id: CLEAR_OPTION_ID, name: resolvedClearLabel }),
    [resolvedClearLabel]
  );

  return (
    <Select<PhaseOption>
      getValues={() => options}
      value={selected}
      onChange={(id) => onChange(id || null)}
      disabled={disabled}
      placeholder={emptyLabel}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      onClose={onClose}
      contentSizing={contentSizing}
      headerItems={clearable ? [clearOption] : undefined}
      getOptionValue={(phase) => phase.id}
      getOptionLabel={(phase) => phase.name}
      getOptionIcon={(phase) =>
        phase.id === CLEAR_OPTION_ID ? undefined : <MilestoneOutline className="size-4 shrink-0 text-secondary" />
      }
    >
      <Select.Trigger<PhaseOption>
        disabled={disabled}
        variant={variant}
        tabIndex={tabIndex}
        id={triggerId}
        className={className}
        data-testid={testId}
        prependIcon={<MilestoneOutline />}
        label={(phases) => phases[0]?.name ?? emptyLabel}
        tooltip={tooltip}
      >
        {(phases) => {
          const phase = phases[0];
          const label = phase?.name ?? emptyLabel;
          return (
            (!!phase || !!label) && (
              <span className="min-w-0 grow truncate text-left" data-missing={isMissing || undefined}>
                {label}
              </span>
            )
          );
        }}
      </Select.Trigger>
    </Select>
  );
}

PhaseSelect.displayName = "blocks.PhaseSelect";
