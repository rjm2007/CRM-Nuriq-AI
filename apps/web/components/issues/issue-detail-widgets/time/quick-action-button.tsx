/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { cloneElement } from "react";
import { observer } from "mobx-react";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { AddOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";

type Props = {
  issueId: string;
  /** Rendered as the button itself; receives the click handler and `disabled`. */
  customButton?: React.ReactElement<React.ComponentPropsWithoutRef<"button">>;
  /** Hover label for `customButton`. */
  tooltip?: string;
  disabled?: boolean;
};

/** Opens the "Log time" modal for a new entry on `issueId`. */
export const IssueWorkLogActionButton = observer(function IssueWorkLogActionButton(props: Props) {
  const { issueId, customButton, tooltip, disabled = false } = props;
  const { t } = useTranslation();
  const {
    workLog: { toggleWorkLogModal },
  } = useIssueDetail();

  const handleOnClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWorkLogModal({ issueId, workLogId: null });
  };

  if (customButton) {
    const button = cloneElement(customButton, { onClick: handleOnClick, disabled });
    return tooltip ? <Tooltip label={tooltip}>{button}</Tooltip> : button;
  }

  return (
    <IconButton
      type="button"
      variant="ghost"
      size="sm"
      aria-label={t("work_log.log_time")}
      onClick={handleOnClick}
      disabled={disabled}
      icon={<Icon icon={AddOutline} />}
    />
  );
});
