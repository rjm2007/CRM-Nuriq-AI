/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: keeps a parent's sub-work item progress ("done/total") fresh when a child's state changes,
// and re-fetches the parent once the API's Celery task has auto-completed it.
// Pure rules live in @plane/utils (work-item/subtask-rules.ts); this file only wires them to the stores.
import { SUBTASK_ROLLUP_REFETCH_DELAY_MS } from "@plane/constants";
import type { TIssue, TStateGroups } from "@plane/types";
import { adjustCompletedSubIssuesCount, getCompletedSubIssuesCountDelta, isSubtaskRollupReady } from "@plane/utils";
// local imports
import type { IIssueRootStore } from "../root.store";

/** One pending re-fetch per parent, so several quick child updates trigger a single request. */
const pendingParentRefetch = new Map<string, ReturnType<typeof setTimeout>>();

const getStateGroup = (rootIssueStore: IIssueRootStore, stateId: string | null | undefined) =>
  rootIssueStore.rootStore.state.getStateById(stateId)?.group as TStateGroups | undefined;

const getSiblingIds = (rootIssueStore: IIssueRootStore, parentId: string): string[] => {
  const fromSubIssues = rootIssueStore.issueDetail.subIssues.subIssuesByIssueId(parentId);
  if (fromSubIssues && fromSubIssues.length > 0) return fromSubIssues;
  return Object.values(rootIssueStore.issues.issuesMap)
    .filter((issue) => issue?.parent_id === parentId && !issue.archived_at)
    .map((issue) => issue.id);
};

/**
 * Optimistically moves the parent's `completed_sub_issues_count` when a child's state crosses into or
 * out of the completed group. Returns a function that undoes the change (call it if the API fails).
 */
export const syncParentCompletedCount = (
  rootIssueStore: IIssueRootStore,
  issueBefore: TIssue | undefined,
  data: Partial<TIssue>
): (() => void) | undefined => {
  if (!issueBefore?.parent_id || !("state_id" in data) || data.state_id === issueBefore.state_id) return undefined;
  const parent = rootIssueStore.issues.getIssueById(issueBefore.parent_id);
  if (!parent || parent.completed_sub_issues_count === undefined) return undefined;

  const delta = getCompletedSubIssuesCountDelta(
    getStateGroup(rootIssueStore, issueBefore.state_id),
    getStateGroup(rootIssueStore, data.state_id)
  );
  if (delta === 0) return undefined;

  const parentId = parent.id;
  const previous = parent.completed_sub_issues_count;
  rootIssueStore.issues.updateIssue(parentId, {
    completed_sub_issues_count: adjustCompletedSubIssuesCount(previous, delta, parent.sub_issues_count),
  });
  return () => rootIssueStore.issues.updateIssue(parentId, { completed_sub_issues_count: previous });
};

const refetchParent = async (
  rootIssueStore: IIssueRootStore,
  workspaceSlug: string,
  projectId: string,
  parentId: string,
  fetchIssues: (workspaceSlug: string, projectId: string, issueIds: string[]) => Promise<TIssue[]>,
  applyParentUpdate: (projectId: string, parentId: string, parent: Partial<TIssue>) => void
) => {
  try {
    const issues = await fetchIssues(workspaceSlug, projectId, [parentId]);
    const freshParent = issues?.find((issue) => issue.id === parentId);
    if (!freshParent) return;
    applyParentUpdate(projectId, parentId, freshParent);
    // refresh the parent's Activity tab if it is loaded (detail page or peek)
    if (rootIssueStore.issueDetail.activity.getActivitiesByIssueId(parentId))
      await rootIssueStore.issueDetail.activity.fetchActivities(workspaceSlug, projectId, parentId, "mutate");
  } catch (error) {
    console.error("Error re-fetching the parent work item", error);
  }
};

/**
 * After a child's state change is saved: if every sibling is now completed or cancelled (at least one
 * completed), re-fetch the parent once after a short delay so the API's auto-done shows on its card.
 * `applyParentUpdate` writes the fresh parent into the store (and the current list's grouping).
 */
export const scheduleParentRollupRefetch = (
  rootIssueStore: IIssueRootStore,
  workspaceSlug: string,
  issueBefore: TIssue | undefined,
  data: Partial<TIssue>,
  fetchIssues: (workspaceSlug: string, projectId: string, issueIds: string[]) => Promise<TIssue[]>,
  applyParentUpdate: (projectId: string, parentId: string, parent: Partial<TIssue>) => void
): void => {
  if (!issueBefore?.parent_id || !("state_id" in data) || data.state_id === issueBefore.state_id) return;
  const parent = rootIssueStore.issues.getIssueById(issueBefore.parent_id);
  if (!parent?.project_id || getStateGroup(rootIssueStore, parent.state_id) === "completed") return;

  const siblingIds = getSiblingIds(rootIssueStore, parent.id);
  const groups = siblingIds.map((id) =>
    getStateGroup(rootIssueStore, rootIssueStore.issues.getIssueById(id)?.state_id)
  );
  // When not every sibling is loaded, fall back to the counts (all completed).
  const knowsAllSiblings = siblingIds.length >= (parent.sub_issues_count ?? 0);
  const isReady = knowsAllSiblings
    ? isSubtaskRollupReady(groups)
    : parent.sub_issues_count > 0 && parent.completed_sub_issues_count === parent.sub_issues_count;
  if (!isReady) return;

  const parentId = parent.id;
  const projectId = parent.project_id;
  const pending = pendingParentRefetch.get(parentId);
  if (pending) clearTimeout(pending);
  pendingParentRefetch.set(
    parentId,
    setTimeout(() => {
      pendingParentRefetch.delete(parentId);
      void refetchParent(rootIssueStore, workspaceSlug, projectId, parentId, fetchIssues, applyParentUpdate);
    }, SUBTASK_ROLLUP_REFETCH_DELAY_MS)
  );
};
