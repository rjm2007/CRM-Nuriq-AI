/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import type { ReactNode } from "react";
import type { ComboboxContentSizing } from "@makeplane/propel/components/combobox";
import { PagesOutline } from "@makeplane/propel/icons";
import { Select } from "../select/select";
import type { SelectTooltip, SelectVariant } from "../select/types";

/** Id for the clear row — an empty string maps back to `null` via `id || null` (same as `CycleSelect`). */
const CLEAR_OPTION_ID = "";

/** Minimal page shape the dropdown needs — the client maps its page store record down to this. */
export type PageOption = {
  id: string;
  /** Display name; the client resolves empty names (e.g. via `getPageName`) before passing them in. */
  name: string;
};

export type PageSelectProps = {
  /** Pages the user can pick from. The client decides which pages qualify (e.g. public, non-archived). */
  options: PageOption[];
  /** Selected page id, or `null` when none. */
  value: string | null | undefined;
  /** Emits the picked page id, or `null` when the selection is cleared (the `clearable` row). */
  onChange: (id: string | null) => void;
  /** Controls trigger chrome, button sizing, and arrow visibility. */
  variant: SelectVariant;
  disabled?: boolean;
  /** Trigger text while nothing is selected. */
  placeholder?: string;
  searchPlaceholder?: string;
  /** Trigger text when `value` is set but no option matches it (page deleted, made private, not loaded). */
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
 * Presentational, data-source-agnostic single page picker built on the generic `Select` (sync mode).
 * The client passes the candidate pages in as `options`; this block owns only the page-specific markup.
 */
export function PageSelect(props: PageSelectProps) {
  const {
    options,
    value,
    onChange,
    variant,
    disabled = false,
    placeholder = "",
    searchPlaceholder = "Search pages...",
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

  const selected = value ? (options.find((page) => page.id === value) ?? null) : null;
  const isMissing = !!value && !selected;
  const emptyLabel = isMissing && missingLabel ? missingLabel : placeholder;
  const resolvedClearLabel = clearLabel ?? placeholder;
  const clearOption = useMemo<PageOption>(
    () => ({ id: CLEAR_OPTION_ID, name: resolvedClearLabel }),
    [resolvedClearLabel]
  );

  return (
    <Select<PageOption>
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
      getOptionValue={(page) => page.id}
      getOptionLabel={(page) => page.name}
      getOptionIcon={(page) =>
        page.id === CLEAR_OPTION_ID ? undefined : <PagesOutline className="size-4 shrink-0 text-secondary" />
      }
    >
      <Select.Trigger<PageOption>
        disabled={disabled}
        variant={variant}
        tabIndex={tabIndex}
        id={triggerId}
        className={className}
        data-testid={testId}
        prependIcon={<PagesOutline />}
        label={(pages) => pages[0]?.name ?? emptyLabel}
        tooltip={tooltip}
      >
        {(pages) => {
          const page = pages[0];
          const label = page?.name ?? emptyLabel;
          return (
            (!!page || !!label) && (
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

PageSelect.displayName = "blocks.PageSelect";
