/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { useTranslation } from "@plane/i18n";
import { cn, formatWorkLogDuration } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";

type Props = {
  issueId: string;
  className?: string;
  /** e2e selector; the widget and the sidebar each pass their own. */
  testId?: string;
};

/**
 * Total time on a work item ("1h 30m", own + direct sub-work items). The tooltip splits own vs
 * including sub-work items. Used as the time widget's title accessory and in the sidebar row.
 */
export const IssueWorkLogTotal = observer(function IssueWorkLogTotal(props: Props) {
  const { issueId, className, testId = "work-log-total" } = props;
  const { t } = useTranslation();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  // derived values
  const issue = getIssueById(issueId);
  const total = issue?.total_logged_minutes ?? issue?.logged_minutes ?? 0;
  const own = issue?.logged_minutes ?? total;
  const tooltip = [
    t("work_log.own", { duration: formatWorkLogDuration(own) }),
    t("work_log.including_sub_work_items", { duration: formatWorkLogDuration(total) }),
  ].join(" · ");

  const shown = formatWorkLogDuration(total);

  // A real button is the tooltip trigger, so keyboard users reach it; the sr-only text gives the
  // full split as its name (the visible "1h 30m" alone would be ambiguous).
  return (
    <Tooltip label={tooltip} layout="stacked">
      <button
        type="button"
        className={cn(
          "cursor-default rounded-sm text-caption-md-medium text-secondary outline-none focus-visible:ring-2 focus-visible:ring-accent-strong",
          className
        )}
        data-testid={testId}
      >
        <span aria-hidden="true">{shown}</span>
        <span className="sr-only">{`${t("work_log.title")}: ${shown}. ${tooltip}`}</span>
      </button>
    </Tooltip>
  );
});
