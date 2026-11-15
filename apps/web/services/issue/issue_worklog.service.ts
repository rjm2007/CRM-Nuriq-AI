/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: time tracking (IssueWorkLog) API client. Backend: apps/api/plane/app/views/issue/worklog.py

import { API_BASE_URL } from "@plane/constants";
import type {
  TIssueWorkLog,
  TIssueWorkLogPayload,
  TPaginatedResponse,
  TWorkLogFilters,
  TWorkLogSummary,
} from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class IssueWorkLogService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  /** Every time entry of one work item, newest first. */
  async list(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueWorkLog[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklogs/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async create(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: TIssueWorkLogPayload
  ): Promise<TIssueWorkLog> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklogs/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    workLogId: string,
    data: Partial<TIssueWorkLogPayload>
  ): Promise<TIssueWorkLog> {
    return this.patch(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklogs/${workLogId}/`,
      data
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async remove(workspaceSlug: string, projectId: string, issueId: string, workLogId: string): Promise<void> {
    return this.delete(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklogs/${workLogId}/`
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /** Paginated time entries of a project (filters: user, issue, date range, include_subtasks). */
  async listProjectWorkLogs(
    workspaceSlug: string,
    projectId: string,
    params?: TWorkLogFilters
  ): Promise<TPaginatedResponse<TIssueWorkLog[]>> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/worklogs/`, { params })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /** `{ total_minutes, by_user }` for the same filters as the project list. */
  async getProjectSummary(
    workspaceSlug: string,
    projectId: string,
    params?: Omit<TWorkLogFilters, "cursor" | "per_page">
  ): Promise<TWorkLogSummary> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/worklogs/summary/`, { params })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
