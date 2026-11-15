/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { TooltipProvider } from "@makeplane/propel/components/tooltip";
import {
  AttachOutline,
  LinkOutline,
  RelationsOutline,
  SubWorkItemsOutline,
  TimeTrackingOutline,
} from "@makeplane/propel/icons";
// plane imports
import {
  EntityDetailWidgetToolbar,
  EntityDetailWidgetToolbarGroup,
  EntityDetailWidgetToolbarIconButton,
  EntityDetailWidgetToolbarMenuButton,
  EntityDetailWidgetToolbarTextButton,
} from "@plane/blocks/entity-detail";
import { useTranslation } from "@plane/i18n";
import type { TIssueServiceType, TWorkItemWidgets } from "@plane/types";
// local imports
import { IssueAttachmentActionButton } from "./attachments";
import { IssueLinksActionButton } from "./links";
import { RelationActionButton } from "./relations";
import { SubIssuesActionButton } from "./sub-issues";
import { IssueWorkLogActionButton, useWorkLogPermissions } from "./time";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
  issueServiceType: TIssueServiceType;
  hideWidgets?: TWorkItemWidgets[];
};

export const IssueDetailWidgetActionButtons = observer(function IssueDetailWidgetActionButtons(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled, issueServiceType, hideWidgets } = props;
  // translation
  const { t } = useTranslation();
  // derived values
  // Neuric: on a sub-work item, SubIssuesActionButton renders disabled with a tooltip (one level only)
  const showLinks = !hideWidgets?.includes("links");
  const showAttachments = !hideWidgets?.includes("attachments");
  // Neuric: time tracking, only when the project flag is on and the user is a project admin/member
  const workLogPermissions = useWorkLogPermissions(workspaceSlug, projectId, issueServiceType, issueId);
  const showTime = !hideWidgets?.includes("time") && workLogPermissions.isEnabled && workLogPermissions.canLog;

  return (
    <TooltipProvider>
      <EntityDetailWidgetToolbar aria-label={t("entity_detail_toolbar")}>
        {!hideWidgets?.includes("sub-work-items") && (
          <EntityDetailWidgetToolbarGroup>
            <SubIssuesActionButton
              issueId={issueId}
              customButton={
                <EntityDetailWidgetToolbarTextButton
                  icon={<SubWorkItemsOutline className="size-3.5 shrink-0" />}
                  label={t("issue.add.sub_issue")}
                  disabled={disabled}
                />
              }
              disabled={disabled}
              issueServiceType={issueServiceType}
            />
          </EntityDetailWidgetToolbarGroup>
        )}
        {!hideWidgets?.includes("relations") && (
          <EntityDetailWidgetToolbarGroup>
            <RelationActionButton
              issueId={issueId}
              customButton={
                <EntityDetailWidgetToolbarMenuButton
                  icon={<RelationsOutline className="size-3.5 shrink-0" />}
                  aria-label={t("issue.add.relation")}
                  disabled={disabled}
                />
              }
              disabled={disabled}
              issueServiceType={issueServiceType}
            />
          </EntityDetailWidgetToolbarGroup>
        )}
        {(showLinks || showAttachments) && (
          <EntityDetailWidgetToolbarGroup>
            {showLinks && (
              <IssueLinksActionButton
                tooltip={t("issue.add.link")}
                customButton={
                  <EntityDetailWidgetToolbarIconButton
                    icon={<LinkOutline className="size-3.5 shrink-0" />}
                    aria-label={t("issue.add.link")}
                  />
                }
                disabled={disabled}
                issueServiceType={issueServiceType}
              />
            )}
            {showAttachments && (
              <IssueAttachmentActionButton
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                issueId={issueId}
                tooltip={t("common.attach")}
                customButton={
                  <EntityDetailWidgetToolbarIconButton
                    icon={<AttachOutline className="size-3.5 shrink-0" />}
                    aria-label={t("common.attach")}
                  />
                }
                disabled={disabled}
                issueServiceType={issueServiceType}
              />
            )}
          </EntityDetailWidgetToolbarGroup>
        )}
        {showTime && (
          <EntityDetailWidgetToolbarGroup>
            <IssueWorkLogActionButton
              issueId={issueId}
              tooltip={t("work_log.log_time")}
              customButton={
                <EntityDetailWidgetToolbarIconButton
                  icon={<TimeTrackingOutline className="size-3.5 shrink-0" />}
                  aria-label={t("work_log.log_time")}
                />
              }
              disabled={disabled}
            />
          </EntityDetailWidgetToolbarGroup>
        )}
      </EntityDetailWidgetToolbar>
    </TooltipProvider>
  );
});
