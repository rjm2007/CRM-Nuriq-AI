/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { cloneElement } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { AddOutline, WorkItemsOutline } from "@makeplane/propel/icons";
import type { TIssue, TIssueServiceType } from "@plane/types";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { canAddSubWorkItems } from "@plane/utils";
// components
import { handleTriggerClick, handleTriggerKeyDown } from "@/components/common/trigger-guard";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";

type Props = {
  issueId: string;
  /** Rendered as the trigger itself (not nested inside one); must forward ref and props to a `<button>`. */
  customButton?: React.ReactElement;
  disabled?: boolean;
  issueServiceType: TIssueServiceType;
};

export const SubIssuesActionButton = observer(function SubIssuesActionButton(props: Props) {
  const { issueId, customButton, disabled = false, issueServiceType } = props;
  // translation
  const { t } = useTranslation();
  // store hooks
  const {
    issue: { getIssueById },
    toggleCreateIssueModal,
    toggleSubIssuesModal,
    setIssueCrudOperationState,
    issueCrudOperationState,
  } = useIssueDetail(issueServiceType);

  // derived values
  const issue = getIssueById(issueId);

  if (!issue) return <></>;
  // Neuric: one level of sub-work items only, so a sub-work item can't get its own (disabled + tooltip)
  const isBlocked = !canAddSubWorkItems(issue);
  const isTriggerDisabled = disabled || isBlocked;

  // handlers
  const handleIssueCrudState = (
    key: "create" | "existing",
    _parentIssueId: string | null,
    crudIssue: TIssue | null = null
  ) => {
    setIssueCrudOperationState({
      ...issueCrudOperationState,
      [key]: {
        toggle: !issueCrudOperationState[key].toggle,
        parentIssueId: _parentIssueId,
        issue: crudIssue,
      },
    });
  };

  const handleCreateNew = () => {
    handleIssueCrudState("create", issueId, null);
    toggleCreateIssueModal(true);
  };

  const handleAddExisting = () => {
    handleIssueCrudState("existing", issueId, null);
    toggleSubIssuesModal(issue.id);
  };

  // options
  const optionItems = [
    {
      i18n_label: "common.create_new",
      icon: <AddOutline className="h-3 w-3" />,
      onClick: handleCreateNew,
    },
    {
      i18n_label: "common.add_existing",
      icon: <WorkItemsOutline className="h-3 w-3" />,
      onClick: handleAddExisting,
    },
  ];

  const menu = (
    <Menu>
      {customButton ? (
        <MenuTrigger
          disabled={isTriggerDisabled}
          // Base UI lets the render element's own props win, so the toolbar button's `disabled` must
          // be set on the element itself or it keeps its enabled look (data-disabled styling).
          render={cloneElement(customButton as React.ReactElement<{ disabled?: boolean }>, {
            disabled: isTriggerDisabled,
          })}
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKeyDown}
        />
      ) : (
        <MenuTrigger
          disabled={isTriggerDisabled}
          aria-label={t("issue.add.sub_issue")}
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKeyDown}
        >
          <AddOutline className="size-3.5" />
        </MenuTrigger>
      )}
      <MenuContent side="bottom" align="start">
        {optionItems.map((item) => (
          <MenuItem
            key={item.i18n_label}
            icon={item.icon}
            label={t(item.i18n_label)}
            onClick={(e) => {
              e.stopPropagation();
              item.onClick();
            }}
          />
        ))}
      </MenuContent>
    </Menu>
  );

  if (!isBlocked || disabled) return menu;
  return (
    <Tooltip label={t("sub_work_item.add_disabled")} side="bottom">
      {/* A disabled trigger gets no hover, so this wrapper takes it for the tooltip. */}
      <span className="inline-flex cursor-not-allowed">{menu}</span>
    </Tooltip>
  );
});
