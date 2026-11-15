/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type * as React from "react";
import { Icon } from "@makeplane/propel/components/icon";
import { Pill } from "@makeplane/propel/components/pill";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Pill as PillElement, PillLabel } from "@makeplane/propel/elements/pill";
import { cn } from "@plane/utils";

export type WorkItemPropertyCountChipProps = {
  /** The property glyph, e.g. `SubWorkItemsOutline`; rendered at the chip's icon size. */
  icon: React.ComponentProps<typeof Icon>["icon"];
  count: number;
  /** Text shown instead of `count`, e.g. `"3/5"` for done/total sub-work items. Defaults to `count`. */
  displayValue?: string;
  /**
   * Value read out in the accessible name and tooltip instead of the shown text, e.g. "3 of 5 done"
   * for `"3/5"`. Defaults to the shown text.
   */
  accessibleValue?: string;
  /** Translated property name, e.g. "Attachments". Tooltip and accessible name read "<label>: <value>". */
  label: string;
  /** Makes the chip a button. Omit for a display-only chip (e.g. public boards). */
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
  /** Hides the tooltip, e.g. on touch devices. */
  tooltipDisabled?: boolean;
};

/**
 * An outlined count chip for a work item's sub-work items, attachments or links. With `onClick` it
 * is a button; without, it is a display-only chip that is not focusable. `displayValue` overrides the
 * shown text (e.g. `"3/5"`).
 */
export function WorkItemPropertyCountChip(props: WorkItemPropertyCountChipProps) {
  const { icon, count, displayValue, accessibleValue, label, onClick, onFocus, tooltipDisabled = false } = props;
  const value = displayValue ?? `${count}`;
  const accessibleName = `${label}: ${accessibleValue ?? value}`;

  return (
    <Tooltip label={accessibleName} disabled={tooltipDisabled}>
      {onClick ? (
        <Pill
          size="sm"
          aria-label={accessibleName}
          label={value}
          startIcon={<Icon icon={icon} />}
          onClick={onClick}
          onFocus={onFocus}
        />
      ) : (
        <PillElement
          size="sm"
          variant="outline"
          aria-label={accessibleName}
          render={(pillProps) => {
            // A display-only chip is a span, so it takes no button `type` and no focus.
            const { type: _buttonType, ...spanProps } = pillProps as typeof pillProps & { type?: string };
            return <span {...spanProps} role="img" className={cn(spanProps.className, "cursor-[inherit]")} />;
          }}
        >
          <Icon icon={icon} />
          <PillLabel>{value}</PillLabel>
        </PillElement>
      )}
    </Tooltip>
  );
}
