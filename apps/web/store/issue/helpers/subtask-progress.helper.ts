/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: keeps a parent's sub-work item progress ("done/total") fresh when a child's state changes,
// and re-fetches the parent once the API's Celery task has auto-completed it.
// Pure rules live in @plane/utils (work-item/subtask-rules.ts); this file only wires them to the stores.
import { clone } from "lodash-es";
import { SUBTASK_ROLLUP_ACTIVITY_REFETCH_DELAY_MS, SUBTASK_ROLLUP_REFETCH_DELAYS_MS } from "@plane/constants";
import type { TIssue, TStateGroups } from "@plane/types";
import {
  adjustCompletedSubIssuesCount,
  applyCompletedSubIssuesCountDelta,
  getCompletedSubIssuesCountDelta,
  isSubtaskRollupReady,
  isSubtaskRollupReadyFromCounts,
} from "@plane/utils";
// local imports
import type { IIssueRootStore } from "../root.store";
import type { IBaseIssuesStore } from "./base-issues.store";

type TFetchIssues = (workspaceSlug: string, projectId: string, issueIds: string[]) => Promise<TIssue[]>;

/** One running re-fetch job per parent; its identity tells a stale callback (superseded/cleared) to stop. */
type TRefetchJob = { timer?: ReturnType<typeof setTimeout> };
const pendingParentRefetch = new Map<string, TRefetchJob>();

/** Cancels every scheduled parent re-fetch (called on sign-out so no request runs for the old session). */
export const clearPendingParentRefetches = (): void => {
  for (const job of pendingParentRefetch.values()) if (job.timer) clearTimeout(job.timer);
  pendingParentRefetch.clear();
};

const getStateGroup = (rootIssueStore: IIssueRootStore, stateId: string | null | undefined) =>
  rootIssueStore.rootStore.state.getStateById(stateId)?.group as TStateGroups | undefined;

const isClosedGroup = (group: TStateGroups | undefined) => group === "completed" || group === "cancelled";

const getSiblingIds = (rootIssueStore: IIssueRootStore, parentId: string): string[] => {
  const fromSubIssues = rootIssueStore.issueDetail.subIssues.subIssuesByIssueId(parentId);
  if (fromSubIssues && fromSubIssues.length > 0) return fromSubIssues;
  return Object.values(rootIssueStore.issues.issuesMap)
    .filter((issue) => issue?.parent_id === parentId && !issue.archived_at)
    .map((issue) => issue.id);
};

/**
 * The list store behind the page the user is on now (same route order as `useIssueStoreType`).
 * Teamspace and epic lists are not covered; their cards still update through the shared issue map.
 */
const getCurrentListStore = (rootIssueStore: IIssueRootStore): IBaseIssuesStore | undefined => {
  if (rootIssueStore.teamspaceId) return undefined;
  if (rootIssueStore.globalViewId) return rootIssueStore.workspaceIssues;
  if (rootIssueStore.userId) return rootIssueStore.profileIssues;
  if (rootIssueStore.viewId) return rootIssueStore.projectViewIssues;
  if (rootIssueStore.cycleId) return rootIssueStore.cycleIssues;
  if (rootIssueStore.moduleId) return rootIssueStore.moduleIssues;
  if (rootIssueStore.projectId) return rootIssueStore.projectIssues;
  return undefined;
};

/** True when `issueId` sits anywhere in a grouped (`{group: ids}`) or sub-grouped (`{group: {sub: ids}}`) list. */
const isInGroupedIssueIds = (grouped: unknown, issueId: string): boolean => {
  if (Array.isArray(grouped)) return grouped.includes(issueId);
  if (typeof grouped !== "object" || grouped === null) return false;
  return Object.values(grouped).some((value) => isInGroupedIssueIds(value, issueId));
};

/**
 * Writes the fresh parent into the shared issue map (every view reads it), then regroups it in the
 * current page's list, but only if that list already shows it (regrouping adds missing ids).
 */
const applyFreshParent = (rootIssueStore: IIssueRootStore, parentId: string, freshParent: TIssue) => {
  const before = clone(rootIssueStore.issues.getIssueById(parentId));
  rootIssueStore.issues.updateIssue(parentId, freshParent);
  const listStore = getCurrentListStore(rootIssueStore);
  if (!before || !listStore || !isInGroupedIssueIds(listStore.groupedIssueIds, parentId)) return;
  listStore.updateIssueList({ ...before, ...freshParent }, before);
};

/**
 * Optimistically moves the parent's `completed_sub_issues_count` when a child's state crosses into or
 * out of the completed group. Returns a function that undoes the change (call it if the API fails).
 * The undo reverses the delta on top of the current count, so a sibling's change made meanwhile is kept.
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
  const { next, applied } = applyCompletedSubIssuesCountDelta(
    parent.completed_sub_issues_count,
    delta,
    parent.sub_issues_count
  );
  if (applied === 0) return undefined;
  rootIssueStore.issues.updateIssue(parentId, { completed_sub_issues_count: next });
  return () => {
    const current = rootIssueStore.issues.getIssueById(parentId);
    if (!current) return;
    rootIssueStore.issues.updateIssue(parentId, {
      completed_sub_issues_count: adjustCompletedSubIssuesCount(
        current.completed_sub_issues_count,
        -applied,
        current.sub_issues_count
      ),
    });
  };
};

/** Re-fetches the parent's Activity tab if it is loaded (detail page or peek). */
const refetchParentActivity = async (
  rootIssueStore: IIssueRootStore,
  workspaceSlug: string,
  projectId: string,
  parentId: string
) => {
  try {
    if (rootIssueStore.issueDetail.activity.getActivitiesByIssueId(parentId))
      await rootIssueStore.issueDetail.activity.fetchActivities(workspaceSlug, projectId, parentId, "mutate");
  } catch (error) {
    console.error("Error re-fetching the parent work item's activity", error);
  }
};

/**
 * Try `attempt` of the parent re-fetch: waits `SUBTASK_ROLLUP_REFETCH_DELAYS_MS[attempt]`, re-fetches,
 * writes the parent, and stops once it is completed or cancelled (then refreshes its activity a bit
 * later). Otherwise it tries again with the next, longer delay until the delays run out.
 */
const runParentRefetch = (
  rootIssueStore: IIssueRootStore,
  workspaceSlug: string,
  projectId: string,
  parentId: string,
  fetchIssues: TFetchIssues,
  job: TRefetchJob,
  attempt: number
) => {
  const isCurrent = () => pendingParentRefetch.get(parentId) === job;
  job.timer = setTimeout(() => {
    job.timer = undefined;
    if (!isCurrent()) return;
    void (async () => {
      let freshParent: TIssue | undefined;
      try {
        const issues = await fetchIssues(workspaceSlug, projectId, [parentId]);
        freshParent = issues?.find((issue) => issue.id === parentId);
      } catch (error) {
        console.error("Error re-fetching the parent work item", error);
      }
      // superseded by a newer job, or cleared on sign-out, while the request was in flight
      if (!isCurrent()) return;
      if (freshParent) applyFreshParent(rootIssueStore, parentId, freshParent);

      if (freshParent && isClosedGroup(getStateGroup(rootIssueStore, freshParent.state_id))) {
        job.timer = setTimeout(() => {
          job.timer = undefined;
          if (!isCurrent()) return;
          pendingParentRefetch.delete(parentId);
          void refetchParentActivity(rootIssueStore, workspaceSlug, projectId, parentId);
        }, SUBTASK_ROLLUP_ACTIVITY_REFETCH_DELAY_MS);
        return;
      }

      if (attempt + 1 < SUBTASK_ROLLUP_REFETCH_DELAYS_MS.length)
        runParentRefetch(rootIssueStore, workspaceSlug, projectId, parentId, fetchIssues, job, attempt + 1);
      else pendingParentRefetch.delete(parentId);
    })();
  }, SUBTASK_ROLLUP_REFETCH_DELAYS_MS[attempt]);
};

/**
 * After a child's state change is saved: if every sibling is now completed or cancelled (at least one
 * completed), re-fetch the parent (with backoff) so the API's auto-done shows on its card.
 * Call it after the child's new state is in the store.
 */
export const scheduleParentRollupRefetch = (
  rootIssueStore: IIssueRootStore,
  workspaceSlug: string,
  issueBefore: TIssue | undefined,
  data: Partial<TIssue>,
  fetchIssues: TFetchIssues
): void => {
  if (!issueBefore?.parent_id || !("state_id" in data) || data.state_id === issueBefore.state_id) return;
  const parent = rootIssueStore.issues.getIssueById(issueBefore.parent_id);
  // nothing to wait for when the parent is already closed
  if (!parent?.project_id || isClosedGroup(getStateGroup(rootIssueStore, parent.state_id))) return;

  const siblingIds = getSiblingIds(rootIssueStore, parent.id);
  const groups = siblingIds.map((id) =>
    getStateGroup(rootIssueStore, rootIssueStore.issues.getIssueById(id)?.state_id)
  );
  // When not every sibling is loaded, fall back to the counts plus the cancelled siblings we know of.
  const knowsAllSiblings = siblingIds.length >= (parent.sub_issues_count ?? 0);
  const isReady = knowsAllSiblings
    ? isSubtaskRollupReady(groups)
    : isSubtaskRollupReadyFromCounts(
        parent.sub_issues_count,
        parent.completed_sub_issues_count,
        groups.filter((group) => group === "cancelled").length
      );
  if (!isReady) return;

  const parentId = parent.id;
  const previous = pendingParentRefetch.get(parentId);
  if (previous?.timer) clearTimeout(previous.timer);
  const job: TRefetchJob = {};
  pendingParentRefetch.set(parentId, job);
  runParentRefetch(rootIssueStore, workspaceSlug, parent.project_id, parentId, fetchIssues, job, 0);
};
