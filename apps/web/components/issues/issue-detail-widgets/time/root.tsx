/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { EntityDetailWidgetSection } from "@plane/blocks/entity-detail";
import { useTranslation } from "@plane/i18n";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// local imports
import { IssueWorkLogCollapsibleContent } from "./content";
import type { TWorkLogPermissions } from "./helper";
import { IssueWorkLogActionButton } from "./quick-action-button";
import { IssueWorkLogTotal } from "./title";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled?: boolean;
  permissions: TWorkLogPermissions;
};

/** "Time logged" section of the work item detail: total, entries and a "Log time" action. */
export const TimeCollapsible = observer(function TimeCollapsible(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled = false, permissions } = props;
  const { t } = useTranslation();
  const {
    openWidgets,
    toggleOpenWidget,
    workLog: { fetchWorkLogs, getWorkLogsByIssueId },
  } = useIssueDetail();
  // fetch entries once per work item
  useSWR(
    workspaceSlug && projectId && issueId ? `ISSUE_WORKLOGS_${issueId}` : null,
    () => fetchWorkLogs(workspaceSlug, projectId, issueId),
    { revalidateOnFocus: false }
  );
  // derived values
  const isCollapsibleOpen = openWidgets.includes("time");
  const entriesCount = getWorkLogsByIssueId(issueId)?.length ?? 0;
  const canWrite = !disabled && permissions.isEnabled && permissions.canLog;

  return (
    <EntityDetailWidgetSection
      title={t("work_log.title")}
      count={entriesCount}
      isOpen={isCollapsibleOpen}
      onToggle={() => toggleOpenWidget("time")}
      titleAccessory={<IssueWorkLogTotal issueId={issueId} />}
      actions={canWrite ? <IssueWorkLogActionButton issueId={issueId} /> : undefined}
    >
      <IssueWorkLogCollapsibleContent
        issueId={issueId}
        permissions={canWrite ? permissions : { ...permissions, canManage: () => false }}
      />
    </EntityDetailWidgetSection>
  );
});
