/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { Skeleton, SkeletonItem } from "@makeplane/propel/components/skeleton";
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
    issue: { getIssueById },
    workLog: { fetchWorkLogs, getWorkLogsByIssueId },
  } = useIssueDetail();
  // derived values
  // Archived work items have no time tracking widget (the API refuses writes on them).
  const isArchived = !!getIssueById(issueId)?.archived_at;
  // fetch entries once per work item
  const { error, isLoading, mutate } = useSWR(
    workspaceSlug && projectId && issueId && !isArchived ? `ISSUE_WORKLOGS_${issueId}` : null,
    () => fetchWorkLogs(workspaceSlug, projectId, issueId),
    { revalidateOnFocus: false }
  );
  const entries = getWorkLogsByIssueId(issueId);
  const isCollapsibleOpen = openWidgets.includes("time");
  const entriesCount = entries?.length ?? 0;
  const canWrite = !disabled && permissions.isEnabled && permissions.canLog;

  if (isArchived) return null;

  const body = (() => {
    if (!entries && error)
      return (
        <div role="alert" className="flex items-center gap-2 py-2 text-body-xs-regular text-danger-primary">
          <span>{t("work_log.errors.load_failed")}</span>
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label={t("common.retry")}
            onClick={() => void mutate()}
          />
        </div>
      );
    if (!entries && isLoading)
      return (
        <div className="py-2">
          <Skeleton aria-label={t("common.loading")}>
            <SkeletonItem blockSize="44px" />
            <SkeletonItem blockSize="44px" />
          </Skeleton>
        </div>
      );
    return (
      <IssueWorkLogCollapsibleContent
        issueId={issueId}
        permissions={canWrite ? permissions : { ...permissions, canManage: () => false }}
      />
    );
  })();

  return (
    <EntityDetailWidgetSection
      title={t("work_log.title")}
      count={entriesCount}
      isOpen={isCollapsibleOpen}
      onToggle={() => toggleOpenWidget("time")}
      titleAccessory={<IssueWorkLogTotal issueId={issueId} />}
      actions={canWrite ? <IssueWorkLogActionButton issueId={issueId} /> : undefined}
    >
      {body}
    </EntityDetailWidgetSection>
  );
});
