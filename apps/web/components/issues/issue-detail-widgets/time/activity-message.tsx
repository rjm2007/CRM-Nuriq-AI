/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: text of a time tracking activity row (field "worklog"). Shared by the work item Activity
// tab and the profile / workspace activity feeds (`components/core/activity.tsx`).

import { useTranslation } from "@plane/i18n";
import { formatWorkLogDuration } from "@plane/utils";

/** The fields both activity shapes share (`TIssueActivity` for the Activity tab, `IIssueActivity` for feeds). */
type TWorkLogActivityFields = {
  verb: string;
  old_value?: string | null;
  new_value?: string | null;
  comment?: string | null;
};

const toDuration = (minutes: string | undefined | null) => formatWorkLogDuration(Number(minutes ?? 0));

/**
 * Who the time was logged for, when that isn't the actor. The API only gives it in the created
 * row's comment: `logged <n> minutes for <display name>` (`apps/api/plane/bgtasks/worklog_activity.py`).
 */
export const getWorkLogActivityTargetName = (activity: Pick<TWorkLogActivityFields, "verb" | "comment">) => {
  if (activity.verb !== "created" || !activity.comment) return undefined;
  const match = /^logged \d+ minutes for (.+)$/.exec(activity.comment);
  return match?.[1]?.trim() || undefined;
};

/** "logged a time entry of 1h 30m (for Ada)", "updated a time entry from 1h to 2h", ... */
export function WorkLogActivityMessage(props: { activity: TWorkLogActivityFields }) {
  const { activity } = props;
  const { t } = useTranslation();

  if (activity.verb === "created") {
    const name = getWorkLogActivityTargetName(activity);
    const duration = toDuration(activity.new_value);
    return (
      <>
        {name ? t("work_log.activity.created_for", { duration, name }) : t("work_log.activity.created", { duration })}
      </>
    );
  }
  if (activity.verb === "deleted")
    return <>{t("work_log.activity.deleted", { duration: toDuration(activity.old_value) })}</>;
  if (activity.old_value && activity.old_value !== activity.new_value)
    return (
      <>
        {t("work_log.activity.updated", { from: toDuration(activity.old_value), to: toDuration(activity.new_value) })}
      </>
    );
  return <>{t("work_log.activity.updated_same", { duration: toDuration(activity.new_value) })}</>;
}
