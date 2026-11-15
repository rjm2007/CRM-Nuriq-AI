/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: phase activity rows (field "phase"; old/new value = phase names). Step 2.

import { observer } from "mobx-react";
import { MilestoneOutline } from "@makeplane/propel/icons";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// components
import { PhaseActivityMessage } from "@/components/phases/activity-message";
import { IssueActivityBlockComponent, IssueLink } from "./";

type TIssuePhaseActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

export const IssuePhaseActivity = observer(function IssuePhaseActivity(props: TIssuePhaseActivity) {
  const { activityId, showIssue = false, ends } = props;
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;

  return (
    <IssueActivityBlockComponent
      icon={<MilestoneOutline className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        <PhaseActivityMessage activity={activity} />
        {showIssue && (
          <>
            {" "}
            · <IssueLink activityId={activityId} />
          </>
        )}
        .
      </>
    </IssueActivityBlockComponent>
  );
});
