/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: time tracking (IssueWorkLog) entries of the work item in the detail view / peek.

import { orderBy, set } from "lodash-es";
import { action, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// plane imports
import type { TIssueWorkLog, TIssueWorkLogPayload } from "@plane/types";
// services
import { IssueWorkLogService } from "@/services/issue";
// types
import type { IIssueDetail } from "./root.store";

/**
 * Delays between activity re-fetches after a write: the API writes the activity row in a background
 * task. Stops early once a worklog activity newer than the write shows up.
 */
export const WORKLOG_ACTIVITY_REFETCH_DELAYS_MS = [1500, 3000, 6000] as const;

type TActivityRefetchJob = { timer?: ReturnType<typeof setTimeout> };

/** Running activity re-fetch job per work item id (module level so sign-out can clear them all). */
const pendingActivityRefetch = new Map<string, TActivityRefetchJob>();

/** Cancels every scheduled worklog activity re-fetch (called from `resetOnSignOut`). */
export const clearPendingActivityRefetches = (): void => {
  for (const job of pendingActivityRefetch.values()) if (job.timer) clearTimeout(job.timer);
  pendingActivityRefetch.clear();
};

/** Open state of the log/edit time modal. `workLogId` null = new entry. */
export type TWorkLogModalState = { issueId: string; workLogId: string | null } | null;

export interface IIssueWorkLogStoreActions {
  fetchWorkLogs: (workspaceSlug: string, projectId: string, issueId: string) => Promise<TIssueWorkLog[]>;
  createWorkLog: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: TIssueWorkLogPayload
  ) => Promise<TIssueWorkLog>;
  updateWorkLog: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    workLogId: string,
    data: Partial<TIssueWorkLogPayload>
  ) => Promise<TIssueWorkLog>;
  removeWorkLog: (workspaceSlug: string, projectId: string, issueId: string, workLogId: string) => Promise<void>;
}

export interface IIssueWorkLogStore extends IIssueWorkLogStoreActions {
  // observables
  workLogIds: Record<string, string[]>;
  workLogMap: Record<string, TIssueWorkLog>;
  workLogModal: TWorkLogModalState;
  workLogDeleteId: string | null;
  // helpers
  getWorkLogsByIssueId: (issueId: string) => TIssueWorkLog[] | undefined;
  getWorkLogById: (workLogId: string) => TIssueWorkLog | undefined;
  // ui actions
  toggleWorkLogModal: (state: TWorkLogModalState) => void;
  setWorkLogDeleteId: (workLogId: string | null) => void;
}

export class IssueWorkLogStore implements IIssueWorkLogStore {
  // observables
  workLogIds: Record<string, string[]> = {};
  workLogMap: Record<string, TIssueWorkLog> = {};
  workLogModal: TWorkLogModalState = null;
  workLogDeleteId: string | null = null;
  // root store
  rootIssueDetailStore: IIssueDetail;
  // services
  workLogService;

  constructor(rootStore: IIssueDetail) {
    makeObservable(this, {
      // observables
      workLogIds: observable,
      workLogMap: observable,
      workLogModal: observable.ref,
      workLogDeleteId: observable.ref,
      // actions
      fetchWorkLogs: action,
      createWorkLog: action,
      updateWorkLog: action,
      removeWorkLog: action,
      toggleWorkLogModal: action,
      setWorkLogDeleteId: action,
    });
    this.rootIssueDetailStore = rootStore;
    this.workLogService = new IssueWorkLogService();
  }

  // helpers
  getWorkLogsByIssueId = computedFn((issueId: string) => {
    const ids = this.workLogIds[issueId];
    if (!ids) return undefined;
    const entries = ids.map((id) => this.workLogMap[id]).filter((entry): entry is TIssueWorkLog => !!entry);
    return orderBy(
      entries,
      [(entry) => Date.parse(entry.started_at) || 0, (entry) => Date.parse(entry.created_at) || 0],
      ["desc", "desc"]
    );
  });

  getWorkLogById = (workLogId: string) => this.workLogMap[workLogId] ?? undefined;

  // ui actions
  toggleWorkLogModal = (state: TWorkLogModalState) => {
    this.workLogModal = state;
  };

  setWorkLogDeleteId = (workLogId: string | null) => {
    this.workLogDeleteId = workLogId;
  };

  /**
   * Moves the work item's `logged_minutes` / `total_logged_minutes` and the loaded parent's
   * `total_logged_minutes` (own + direct sub-work items, one level only) by `delta`. Only fields the
   * API already sent (numbers) move; a missing one waits for the next fetch, which is the truth.
   * Written straight into the map so `updated_at` is not bumped (no edit happened to the item).
   */
  private applyMinutesDelta = (issueId: string, delta: number) => {
    if (!delta) return;
    const issues = this.rootIssueDetailStore.rootIssueStore.issues;
    const issue = issues.getIssueById(issueId);
    if (!issue) return;
    const move = (id: string, field: "logged_minutes" | "total_logged_minutes", current: unknown) => {
      if (typeof current !== "number") return;
      set(issues.issuesMap, [id, field], Math.max(0, current + delta));
    };
    runInAction(() => {
      move(issueId, "logged_minutes", issue.logged_minutes);
      move(issueId, "total_logged_minutes", issue.total_logged_minutes);
      const parent = issue.parent_id ? issues.getIssueById(issue.parent_id) : undefined;
      if (parent) move(parent.id, "total_logged_minutes", parent.total_logged_minutes);
    });
  };

  /** Ids of the worklog activity rows already loaded for `issueId`. */
  private getWorkLogActivityIds = (issueId: string): Set<string> => {
    const { activity } = this.rootIssueDetailStore;
    const ids = activity.getActivitiesByIssueId(issueId) ?? [];
    return new Set(ids.filter((id) => activity.getActivityById(id)?.field === "worklog"));
  };

  /**
   * The activity row is written by a background task: fetch now, then retry with backoff
   * (`WORKLOG_ACTIVITY_REFETCH_DELAYS_MS`) until a worklog activity not in `knownIds` appears.
   */
  private refreshActivity = (workspaceSlug: string, projectId: string, issueId: string, knownIds: Set<string>) => {
    const { activity } = this.rootIssueDetailStore;
    // one job per work item: a newer write replaces (and cancels) the older one
    const previous = pendingActivityRefetch.get(issueId);
    if (previous?.timer) clearTimeout(previous.timer);
    const job: TActivityRefetchJob = {};
    pendingActivityRefetch.set(issueId, job);
    const isCurrent = () => pendingActivityRefetch.get(issueId) === job;

    const hasNewRow = () => [...this.getWorkLogActivityIds(issueId)].some((id) => !knownIds.has(id));
    const fetchOnce = () =>
      activity.fetchActivities(workspaceSlug, projectId, issueId, "mutate").catch((error: unknown) => {
        console.error("Failed to refresh work item activity", error);
      });

    const schedule = (attempt: number) => {
      if (!isCurrent()) return;
      const delay = WORKLOG_ACTIVITY_REFETCH_DELAYS_MS[attempt];
      if (delay === undefined || hasNewRow()) {
        pendingActivityRefetch.delete(issueId);
        return;
      }
      job.timer = setTimeout(() => {
        void fetchOnce().then(() => schedule(attempt + 1));
      }, delay);
    };

    void fetchOnce().then(() => schedule(0));
  };

  // actions
  fetchWorkLogs = async (workspaceSlug: string, projectId: string, issueId: string) => {
    const idsBefore = new Set(this.workLogIds[issueId] ?? []);
    const response = await this.workLogService.list(workspaceSlug, projectId, issueId);
    runInAction(() => {
      // Merge with what changed locally while the request was in flight: keep entries created
      // meanwhile, don't bring back entries deleted meanwhile, drop entries gone on the server.
      const current = this.workLogIds[issueId] ?? [];
      const currentSet = new Set(current);
      const deletedMeanwhile = (id: string) => idsBefore.has(id) && !currentSet.has(id);
      const serverEntries = response.filter((entry) => !deletedMeanwhile(entry.id));
      const serverIds = serverEntries.map((entry) => entry.id);
      const serverSet = new Set(serverIds);
      const createdMeanwhile = current.filter((id) => !idsBefore.has(id) && !serverSet.has(id));
      const nextIds = [...createdMeanwhile, ...serverIds];
      const nextSet = new Set(nextIds);
      current.forEach((id) => {
        if (!nextSet.has(id)) delete this.workLogMap[id];
      });
      serverEntries.forEach((entry) => set(this.workLogMap, entry.id, entry));
      this.workLogIds[issueId] = nextIds;
    });
    return response;
  };

  createWorkLog = async (workspaceSlug: string, projectId: string, issueId: string, data: TIssueWorkLogPayload) => {
    const knownActivityIds = this.getWorkLogActivityIds(issueId);
    const response = await this.workLogService.create(workspaceSlug, projectId, issueId, data);
    runInAction(() => {
      set(this.workLogMap, response.id, response);
      const ids = this.workLogIds[issueId] ?? [];
      if (!ids.includes(response.id)) this.workLogIds[issueId] = [response.id, ...ids];
      this.applyMinutesDelta(issueId, response.duration_minutes);
    });
    this.refreshActivity(workspaceSlug, projectId, issueId, knownActivityIds);
    return response;
  };

  updateWorkLog = async (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    workLogId: string,
    data: Partial<TIssueWorkLogPayload>
  ) => {
    const previousMinutes = this.workLogMap[workLogId]?.duration_minutes ?? 0;
    const knownActivityIds = this.getWorkLogActivityIds(issueId);
    const response = await this.workLogService.update(workspaceSlug, projectId, issueId, workLogId, data);
    runInAction(() => {
      set(this.workLogMap, workLogId, response);
      this.applyMinutesDelta(issueId, response.duration_minutes - previousMinutes);
    });
    this.refreshActivity(workspaceSlug, projectId, issueId, knownActivityIds);
    return response;
  };

  removeWorkLog = async (workspaceSlug: string, projectId: string, issueId: string, workLogId: string) => {
    const minutes = this.workLogMap[workLogId]?.duration_minutes ?? 0;
    const knownActivityIds = this.getWorkLogActivityIds(issueId);
    await this.workLogService.remove(workspaceSlug, projectId, issueId, workLogId);
    runInAction(() => {
      this.workLogIds[issueId] = (this.workLogIds[issueId] ?? []).filter((id) => id !== workLogId);
      delete this.workLogMap[workLogId];
      this.applyMinutesDelta(issueId, -minutes);
    });
    this.refreshActivity(workspaceSlug, projectId, issueId, knownActivityIds);
  };
}
