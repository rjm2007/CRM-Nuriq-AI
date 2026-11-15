/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { ConfirmDialog } from "@plane/blocks/dialog";
import { useTranslation } from "@plane/i18n";
import { formatWorkLogDuration } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// local imports
import type { TWorkLogOperations } from "./helper";

type Props = {
  /** The work item this dialog serves; entries of other items are ignored. */
  issueId: string;
  operations: TWorkLogOperations;
};

/** Confirms deleting the entry in `workLog.workLogDeleteId`. */
export const IssueWorkLogDeleteModal = observer(function IssueWorkLogDeleteModal(props: Props) {
  const { issueId, operations } = props;
  const { t } = useTranslation();
  const {
    workLog: { workLogDeleteId, setWorkLogDeleteId, getWorkLogById },
  } = useIssueDetail();
  // states
  const [isSubmitting, setIsSubmitting] = useState(false);
  // derived values
  const candidate = workLogDeleteId ? getWorkLogById(workLogDeleteId) : undefined;
  const entry = candidate?.issue === issueId ? candidate : undefined;

  const handleSubmit = async () => {
    if (!entry) return;
    setIsSubmitting(true);
    try {
      await operations.remove(entry.id);
      setWorkLogDeleteId(null);
    } catch {
      // toast already shown by the operation
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={!!entry}
      handleClose={() => setWorkLogDeleteId(null)}
      handleSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      title={t("work_log.delete.title")}
      content={t("work_log.delete.content", { duration: formatWorkLogDuration(entry?.duration_minutes) })}
      primaryButtonText={{ default: t("common.delete"), loading: t("common.deleting") }}
      secondaryButtonText={t("common.cancel")}
      variant="danger"
    />
  );
});
