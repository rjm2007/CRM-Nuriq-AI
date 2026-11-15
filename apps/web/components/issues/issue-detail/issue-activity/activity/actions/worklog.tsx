/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: time tracking activity rows (field "worklog"; new_value/old_value = minutes as a string).

import { observer } from "mobx-react";
import { TimeTrackingOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import { formatWorkLogDuration } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// components
import { IssueActivityBlockComponent, IssueLink } from "./";

type TIssueWorkLogActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

const toDuration = (minutes: string | undefined | null) => formatWorkLogDuration(Number(minutes ?? 0));

export const IssueWorkLogActivity = observer(function IssueWorkLogActivity(props: TIssueWorkLogActivity) {
  const { activityId, showIssue = false, ends } = props;
  const { t } = useTranslation();
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;

  const message = (() => {
    if (activity.verb === "created")
      return t("work_log.activity.created", { duration: toDuration(activity.new_value) });
    if (activity.verb === "deleted")
      return t("work_log.activity.deleted", { duration: toDuration(activity.old_value) });
    if (activity.old_value && activity.old_value !== activity.new_value)
      return t("work_log.activity.updated", {
        from: toDuration(activity.old_value),
        to: toDuration(activity.new_value),
      });
    return t("work_log.activity.updated_same", { duration: toDuration(activity.new_value) });
  })();

  return (
    <IssueActivityBlockComponent
      icon={<TimeTrackingOutline className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        {message}
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
