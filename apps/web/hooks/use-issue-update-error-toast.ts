/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: one error toast for inline work item edits (list, kanban, spreadsheet properties).
import { useCallback } from "react";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import { getSubtaskRuleError } from "@plane/utils";

/**
 * Returns a handler that shows a single error toast for a failed work item update: the subtask-rule
 * message when the API sent an `error_code`, otherwise the generic "update failed" message.
 * The store already rolled the change back, so callers only need to catch and pass the error here.
 */
export const useIssueUpdateErrorToast = () => {
  const { t } = useTranslation();
  return useCallback(
    (error: unknown) => {
      setToast({
        type: "error",
        title: t("toast.error"),
        message: getSubtaskRuleError(error, t) ?? t("entity.update.failed", { entity: t("issue.label", { count: 1 }) }),
      });
    },
    [t]
  );
};
