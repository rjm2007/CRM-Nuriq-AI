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

/** Delay before a second activity fetch: the API writes the activity row in a background task. */
export const WORKLOG_ACTIVITY_REFETCH_DELAY_MS = 1500;

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
    return orderBy(entries, [(entry) => entry.started_at, (entry) => entry.created_at], ["desc", "desc"]);
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
   * Moves the work item's `logged_minutes` and `total_logged_minutes` by `delta`, and the loaded
   * parent's `total_logged_minutes` (own + direct sub-work items, one level only).
   */
  private applyMinutesDelta = (issueId: string, delta: number) => {
    if (!delta) return;
    const issues = this.rootIssueDetailStore.rootIssueStore.issues;
    const issue = issues.getIssueById(issueId);
    if (!issue) return;
    issues.updateIssue(issueId, {
      logged_minutes: Math.max(0, (issue.logged_minutes ?? 0) + delta),
      total_logged_minutes: Math.max(0, (issue.total_logged_minutes ?? 0) + delta),
    });
    const parent = issue.parent_id ? issues.getIssueById(issue.parent_id) : undefined;
    // Only move a total the API already sent; otherwise the next fetch brings the right number.
    if (parent && typeof parent.total_logged_minutes === "number") {
      issues.updateIssue(parent.id, { total_logged_minutes: Math.max(0, parent.total_logged_minutes + delta) });
    }
  };

  /** The activity row is written by a background task: fetch now and once more shortly after. */
  private refreshActivity = (workspaceSlug: string, projectId: string, issueId: string) => {
    const { activity } = this.rootIssueDetailStore;
    void activity.fetchActivities(workspaceSlug, projectId, issueId, "mutate");
    setTimeout(() => {
      void activity.fetchActivities(workspaceSlug, projectId, issueId, "mutate");
    }, WORKLOG_ACTIVITY_REFETCH_DELAY_MS);
  };

  // actions
  fetchWorkLogs = async (workspaceSlug: string, projectId: string, issueId: string) => {
    const response = await this.workLogService.list(workspaceSlug, projectId, issueId);
    runInAction(() => {
      this.workLogIds[issueId] = response.map((entry) => entry.id);
      response.forEach((entry) => set(this.workLogMap, entry.id, entry));
    });
    return response;
  };

  createWorkLog = async (workspaceSlug: string, projectId: string, issueId: string, data: TIssueWorkLogPayload) => {
    const response = await this.workLogService.create(workspaceSlug, projectId, issueId, data);
    runInAction(() => {
      set(this.workLogMap, response.id, response);
      this.workLogIds[issueId] = [response.id, ...(this.workLogIds[issueId] ?? [])];
      this.applyMinutesDelta(issueId, response.duration_minutes);
    });
    this.refreshActivity(workspaceSlug, projectId, issueId);
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
    const response = await this.workLogService.update(workspaceSlug, projectId, issueId, workLogId, data);
    runInAction(() => {
      set(this.workLogMap, workLogId, response);
      this.applyMinutesDelta(issueId, response.duration_minutes - previousMinutes);
    });
    this.refreshActivity(workspaceSlug, projectId, issueId);
    return response;
  };

  removeWorkLog = async (workspaceSlug: string, projectId: string, issueId: string, workLogId: string) => {
    const minutes = this.workLogMap[workLogId]?.duration_minutes ?? 0;
    await this.workLogService.remove(workspaceSlug, projectId, issueId, workLogId);
    runInAction(() => {
      this.workLogIds[issueId] = (this.workLogIds[issueId] ?? []).filter((id) => id !== workLogId);
      delete this.workLogMap[workLogId];
      this.applyMinutesDelta(issueId, -minutes);
    });
    this.refreshActivity(workspaceSlug, projectId, issueId);
  };
}
