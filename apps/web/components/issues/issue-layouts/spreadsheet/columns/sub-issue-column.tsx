/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useTranslation } from "@plane/i18n";
// types
import type { TIssue } from "@plane/types";
// helpers
import { Row } from "@plane/blocks/layout";
import { cn, formatSubIssuesProgress } from "@plane/utils";
// hooks
import { useAppRouter } from "@/hooks/use-app-router";

type Props = {
  issue: TIssue;
};

export const SpreadsheetSubIssueColumn = observer(function SpreadsheetSubIssueColumn(props: Props) {
  const { issue } = props;
  // router
  const router = useAppRouter();
  // hooks
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  // derived values
  const isEpic = issue?.is_epic;
  const subIssueCount = issue?.sub_issues_count ?? 0;

  const redirectToIssueDetail = () => {
    router.push(
      `/${workspaceSlug?.toString()}/projects/${issue.project_id}/${issue.archived_at ? "archives/" : ""}${isEpic ? "epics" : "issues"}/${issue.id}#sub-issues`
    );
  };

  // Neuric: "done/total" when the list endpoint sent completed_sub_issues_count
  const progress = formatSubIssuesProgress(subIssueCount, issue?.completed_sub_issues_count);
  const label = t("sub_work_item.progress_count", { progress, count: subIssueCount });

  return (
    <Row
      onClick={subIssueCount ? redirectToIssueDetail : () => {}}
      className={cn(
        "flex h-11 w-full items-center border-b-[0.5px] border-subtle py-1 group-[.selected-issue-row]:bg-accent-primary/5 hover:bg-layer-transparent-hover group-[.selected-issue-row]:hover:bg-accent-primary/10",
        {
          "cursor-pointer": subIssueCount,
        }
      )}
    >
      {isEpic ? null : label}
    </Row>
  );
});
