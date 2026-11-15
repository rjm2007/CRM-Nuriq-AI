/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: time tracking (IssueWorkLog) widget helpers: who may log/manage, and the CRUD calls with toasts.

import { useCallback, useMemo } from "react";
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
  /** Project flag on, the work item is a regular work item (not an epic) and not archived. */
  isEnabled: boolean;
  /** Project ADMIN or MEMBER (guests can't read or write time entries). */
  canLog: boolean;
  /** Project ADMIN: manage any entry and log for another member. */
  isAdmin: boolean;
  currentUserId: string | undefined;
  canManage: (entry: Pick<TIssueWorkLog, "user">) => boolean;
};

/**
 * The user's own project role, without Plane's workspace-admin elevation. The worklog API checks
 * this raw role: a workspace admin who is a project guest gets no time tracking access.
 */
export const useRawProjectRole = (workspaceSlug: string, projectId: string): EUserPermissions | undefined => {
  const { workspaceProjectsPermissions } = useUserPermissions();
  return workspaceProjectsPermissions?.[workspaceSlug]?.[projectId] as EUserPermissions | undefined;
};

/** Time tracking rules for the current user in one project (mirrors `apps/api/plane/utils/worklog.py`). */
export const useWorkLogPermissions = (
  workspaceSlug: string,
  projectId: string,
  issueServiceType: TIssueServiceType = EIssueServiceType.ISSUES,
  /** When given, an archived work item turns the widget off (no fetch, no writes). */
  issueId?: string
): TWorkLogPermissions => {
  const { getProjectById } = useProject();
  const { data: currentUser } = useUser();
  const {
    issue: { getIssueById },
  } = useIssueDetail(issueServiceType);
  // derived values
  const role = useRawProjectRole(workspaceSlug, projectId);
  const isArchived = !!issueId && !!getIssueById(issueId)?.archived_at;
  const isEnabled =
    issueServiceType === EIssueServiceType.ISSUES &&
    !isArchived &&
    !!getProjectById(projectId)?.is_time_tracking_enabled;
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

type TWorkLogAction = "create" | "update" | "delete";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** HTTP status the service attaches to its errors (`{ ...body, status }`). */
export const getWorkLogErrorStatus = (error: unknown): number | undefined =>
  isRecord(error) && typeof error.status === "number" ? error.status : undefined;

/** First field message of a DRF 400 body (`{ field: ["msg"] }` or `{ field: "msg" }`). */
const getFirstFieldMessage = (error: unknown): string | undefined => {
  if (!isRecord(error)) return undefined;
  for (const [key, value] of Object.entries(error)) {
    if (key === "status" || key === "error_code") continue;
    const message = Array.isArray(value) ? value.find((item) => typeof item === "string") : value;
    if (typeof message === "string" && message.trim()) return message;
  }
  return undefined;
};

/**
 * Message for a failed worklog call, in this order: the API `error_code`, a 403 on edit/delete
 * (someone else's entry), a 404 (the entry is gone), the first field message of a 400, then the
 * generic message for the action.
 */
const useWorkLogErrorMessage = () => {
  const { t } = useTranslation();
  return useCallback(
    (error: unknown, action: TWorkLogAction) => {
      const code = getWorkLogErrorCode(error);
      if (code === "TIME_TRACKING_DISABLED") return t("work_log.errors.time_tracking_disabled");
      if (code === "INVALID_WORKLOG_USER") return t("work_log.errors.invalid_worklog_user");
      const status = getWorkLogErrorStatus(error);
      if (status === 403 && action !== "create") return t("work_log.errors.forbidden");
      if (status === 404) return t("work_log.errors.not_found");
      if (status === 400) {
        const fieldMessage = getFirstFieldMessage(error);
        if (fieldMessage) return fieldMessage;
      }
      return t(action === "delete" ? "work_log.toasts.delete_error" : "work_log.toasts.save_error");
    },
    [t]
  );
};

/** Create/update/delete calls for one work item, each with a success or error toast. Errors rethrow. */
export const useWorkLogOperations = (workspaceSlug: string, projectId: string, issueId: string): TWorkLogOperations => {
  const { t } = useTranslation();
  const { createWorkLog, updateWorkLog, removeWorkLog, fetchWorkLogs } = useIssueDetail(EIssueServiceType.ISSUES);
  const getErrorMessage = useWorkLogErrorMessage();

  return useMemo(() => {
    const reloadEntries = async () => {
      try {
        await fetchWorkLogs(workspaceSlug, projectId, issueId);
      } catch (fetchError) {
        console.error("Failed to reload time entries", fetchError);
      }
    };
    const handleError = (error: unknown, action: TWorkLogAction) => {
      setToast({ type: "error", title: getErrorMessage(error, action) });
      // the entry was deleted elsewhere: reload the list so it disappears here too
      if (getWorkLogErrorStatus(error) === 404) void reloadEntries();
    };
    return {
      create: async (data) => {
        try {
          await createWorkLog(workspaceSlug, projectId, issueId, data);
          setToast({ type: "success", title: t("work_log.toasts.created") });
        } catch (error) {
          handleError(error, "create");
          throw error;
        }
      },
      update: async (workLogId, data) => {
        try {
          await updateWorkLog(workspaceSlug, projectId, issueId, workLogId, data);
          setToast({ type: "success", title: t("work_log.toasts.updated") });
        } catch (error) {
          handleError(error, "update");
          throw error;
        }
      },
      remove: async (workLogId) => {
        try {
          await removeWorkLog(workspaceSlug, projectId, issueId, workLogId);
          setToast({ type: "success", title: t("work_log.toasts.deleted") });
        } catch (error) {
          handleError(error, "delete");
          throw error;
        }
      },
    };
  }, [
    workspaceSlug,
    projectId,
    issueId,
    createWorkLog,
    updateWorkLog,
    removeWorkLog,
    fetchWorkLogs,
    t,
    getErrorMessage,
  ]);
};
