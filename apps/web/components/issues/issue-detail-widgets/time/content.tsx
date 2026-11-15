/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { Avatar } from "@makeplane/propel/components/avatar";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { DeleteOutline, EditOutline, MoreHorizontalOutline } from "@makeplane/propel/icons";
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import { useTranslation } from "@plane/i18n";
import type { TIssueWorkLog } from "@plane/types";
import { formatWorkLogDuration, getFileURL, renderFormattedDate } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
// local imports
import type { TWorkLogPermissions } from "./helper";

type Props = {
  issueId: string;
  permissions: TWorkLogPermissions;
};

type ItemProps = {
  entry: TIssueWorkLog;
  canManage: boolean;
};

const IssueWorkLogItem = observer(function IssueWorkLogItem(props: ItemProps) {
  const { entry, canManage } = props;
  const { t } = useTranslation();
  const { getUserDetails } = useMember();
  const {
    workLog: { toggleWorkLogModal, setWorkLogDeleteId },
  } = useIssueDetail();
  // derived values
  const member = getUserDetails(entry.user) ?? entry.user_detail;
  const logger =
    entry.created_by !== entry.user ? (getUserDetails(entry.created_by) ?? entry.created_by_detail) : undefined;
  const name = member?.display_name ?? "";
  const duration = formatWorkLogDuration(entry.duration_minutes);

  return (
    <li
      className="group flex items-start gap-3 rounded-lg border-[0.5px] border-subtle bg-surface-2 px-3 py-2 hover:bg-layer-1"
      data-testid="work-log-entry"
    >
      <Avatar
        size="sm"
        alt={name}
        fallback={name?.[0]?.toUpperCase()}
        src={member?.avatar_url ? getFileURL(member.avatar_url) : undefined}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2 text-body-xs-medium text-primary">
          <span className="truncate">{name}</span>
          <span className="shrink-0 text-caption-sm-regular text-tertiary">
            {renderFormattedDate(entry.started_at)}
          </span>
        </div>
        {entry.note && (
          <p className="text-body-xs-regular break-words whitespace-pre-wrap text-secondary">{entry.note}</p>
        )}
        {logger && (
          <span className="text-caption-sm-regular text-placeholder">
            {t("work_log.logged_by", { name: logger.display_name })}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-body-xs-medium text-primary" data-testid="work-log-entry-duration">
          {duration}
        </span>
        {canManage && (
          <Menu>
            <MenuTrigger
              render={
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label={t("work_log.entry_actions")}
                  icon={<Icon icon={MoreHorizontalOutline} />}
                />
              }
            />
            <MenuContent side="bottom" align="end">
              <MenuItem
                icon={<Icon icon={EditOutline} />}
                label={t("common.actions.edit")}
                onClick={() => toggleWorkLogModal({ issueId: entry.issue, workLogId: entry.id })}
              />
              <MenuItem
                icon={<Icon icon={DeleteOutline} />}
                label={t("common.actions.delete")}
                onClick={() => setWorkLogDeleteId(entry.id)}
              />
            </MenuContent>
          </Menu>
        )}
      </div>
    </li>
  );
});

/** Time entries of one work item, newest first, or the "No time logged yet" empty state. */
export const IssueWorkLogCollapsibleContent = observer(function IssueWorkLogCollapsibleContent(props: Props) {
  const { issueId, permissions } = props;
  const { t } = useTranslation();
  const {
    workLog: { getWorkLogsByIssueId },
  } = useIssueDetail();
  // derived values
  const entries = getWorkLogsByIssueId(issueId);

  if (!entries) return null;

  if (entries.length === 0)
    return (
      <EmptyStateCompact
        assetKey="worklog"
        title={t("work_log.empty.title")}
        description={t("work_log.empty.description")}
        align="start"
        rootClassName="py-2"
      />
    );

  return (
    <ul className="flex flex-col gap-2" aria-label={t("work_log.title")}>
      {entries.map((entry) => (
        <IssueWorkLogItem key={entry.id} entry={entry} canManage={permissions.canManage(entry)} />
      ))}
    </ul>
  );
});
