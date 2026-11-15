/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: the parent work item of a sub-work item, used to cap the sub-work item's due date.
import { useContext, useEffect } from "react";
import type { TIssue } from "@plane/types";
import { getDate } from "@plane/utils";
// mobx store
import { StoreContext } from "@/lib/store-context";

/** Parent ids already requested in this session, so a missing parent is fetched at most once. */
const requestedParentIds = new Set<string>();

/**
 * Returns the parent work item from the store (fetching it once if it isn't loaded) and its due date
 * as a `Date`, to pass as `maxDate` to the sub-work item's due-date picker.
 * Call it from an `observer` component so the result updates when the parent arrives.
 */
export const useParentIssue = (
  workspaceSlug: string | undefined,
  projectId: string | null | undefined,
  parentId: string | null | undefined
): { parentIssue: TIssue | undefined; parentTargetDate: Date | undefined } => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error("useParentIssue must be used within StoreProvider");
  const { issues } = context.issue;
  const parentIssue = parentId ? issues.getIssueById(parentId) : undefined;
  const isLoaded = !!parentIssue;

  useEffect(() => {
    if (!workspaceSlug || !projectId || !parentId || isLoaded || requestedParentIds.has(parentId)) return;
    requestedParentIds.add(parentId);
    issues.getIssues(workspaceSlug, projectId, [parentId]).catch((error: unknown) => {
      requestedParentIds.delete(parentId);
      console.error("Error fetching the parent work item", error);
    });
  }, [issues, workspaceSlug, projectId, parentId, isLoaded]);

  return { parentIssue, parentTargetDate: getDate(parentIssue?.target_date) ?? undefined };
};
