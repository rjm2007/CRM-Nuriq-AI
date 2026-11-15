/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: time tracking (IssueWorkLog) widget helpers: who may log/manage, and the CRUD calls with toasts.

import { useMemo } from "react";
// plane imports
import { setToast } from "@plane/blocks/toast";
import { EUserPermissions } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TIssueServiceType, TIssueWorkLog, TIssueWorkLogPayload } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
import { canLogWork, canManageWorkLog, getWorkLogErrorCode } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useUser, useUserPermissions } from "@/hooks/store/user";

export type TWorkLogPermissions = {
  /** Project flag on and the work item is a regular work item (not an epic). */
  isEnabled: boolean;
  /** Project ADMIN or MEMBER (guests can't read or write time entries). */
  canLog: boolean;
  /** Project ADMIN: manage any entry and log for another member. */
  isAdmin: boolean;
  currentUserId: string | undefined;
  canManage: (entry: Pick<TIssueWorkLog, "user">) => boolean;
};

/** Time tracking rules for the current user in one project (mirrors `apps/api/plane/utils/worklog.py`). */
export const useWorkLogPermissions = (
  workspaceSlug: string,
  projectId: string,
  issueServiceType: TIssueServiceType = EIssueServiceType.ISSUES
): TWorkLogPermissions => {
  const { getProjectById } = useProject();
  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const { data: currentUser } = useUser();
  // derived values
  const role = getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId);
  const isEnabled =
    issueServiceType === EIssueServiceType.ISSUES && !!getProjectById(projectId)?.is_time_tracking_enabled;
  const currentUserId = currentUser?.id;

  return {
    isEnabled,
    canLog: canLogWork(role),
    isAdmin: role === EUserPermissions.ADMIN,
    currentUserId,
    canManage: (entry) => canManageWorkLog(entry, currentUserId, role),
  };
};

export type TWorkLogOperations = {
  create: (data: TIssueWorkLogPayload) => Promise<void>;
  update: (workLogId: string, data: Partial<TIssueWorkLogPayload>) => Promise<void>;
  remove: (workLogId: string) => Promise<void>;
};

/** Message for a failed worklog call: the API `error_code` first, then a 403, then `fallbackKey`. */
const useWorkLogErrorMessage = () => {
  const { t } = useTranslation();
  return (error: unknown, fallbackKey: string) => {
    const code = getWorkLogErrorCode(error);
    if (code === "TIME_TRACKING_DISABLED") return t("work_log.errors.time_tracking_disabled");
    if (code === "INVALID_WORKLOG_USER") return t("work_log.errors.invalid_worklog_user");
    // A 403 without a code: editing someone else's entry as a non-admin.
    if (error && typeof error === "object" && "error" in error && typeof error.error === "string")
      return t("work_log.errors.forbidden");
    return t(fallbackKey);
  };
};

/** Create/update/delete calls for one work item, each with a success or error toast. Errors rethrow. */
export const useWorkLogOperations = (workspaceSlug: string, projectId: string, issueId: string): TWorkLogOperations => {
  const { t } = useTranslation();
  const { createWorkLog, updateWorkLog, removeWorkLog } = useIssueDetail(EIssueServiceType.ISSUES);
  const getErrorMessage = useWorkLogErrorMessage();

  return useMemo(
    () => ({
      create: async (data) => {
        try {
          await createWorkLog(workspaceSlug, projectId, issueId, data);
          setToast({ type: "success", title: t("work_log.toasts.created") });
        } catch (error) {
          setToast({ type: "error", title: getErrorMessage(error, "work_log.toasts.save_error") });
          throw error;
        }
      },
      update: async (workLogId, data) => {
        try {
          await updateWorkLog(workspaceSlug, projectId, issueId, workLogId, data);
          setToast({ type: "success", title: t("work_log.toasts.updated") });
        } catch (error) {
          setToast({ type: "error", title: getErrorMessage(error, "work_log.toasts.save_error") });
          throw error;
        }
      },
      remove: async (workLogId) => {
        try {
          await removeWorkLog(workspaceSlug, projectId, issueId, workLogId);
          setToast({ type: "success", title: t("work_log.toasts.deleted") });
        } catch (error) {
          setToast({ type: "error", title: getErrorMessage(error, "work_log.toasts.delete_error") });
          throw error;
        }
      },
    }),
    [workspaceSlug, projectId, issueId, createWorkLog, updateWorkLog, removeWorkLog, t, getErrorMessage]
  );
};
