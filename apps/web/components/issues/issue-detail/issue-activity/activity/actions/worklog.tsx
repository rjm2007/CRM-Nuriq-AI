/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: time tracking activity rows (field "worklog"; new_value/old_value = minutes as a string).

import { observer } from "mobx-react";
import { TimeTrackingOutline } from "@makeplane/propel/icons";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// components
import { WorkLogActivityMessage } from "@/components/issues/issue-detail-widgets/time/activity-message";
import { IssueActivityBlockComponent, IssueLink } from "./";

type TIssueWorkLogActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

export const IssueWorkLogActivity = observer(function IssueWorkLogActivity(props: TIssueWorkLogActivity) {
  const { activityId, showIssue = false, ends } = props;
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;

  return (
    <IssueActivityBlockComponent
      icon={<TimeTrackingOutline className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        <WorkLogActivityMessage activity={activity} />
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
