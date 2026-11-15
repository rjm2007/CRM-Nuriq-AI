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

type TAxiosLikeError = { response?: { status?: number; data?: unknown } };

/** The API error body plus the HTTP `status`, so callers can tell 400/403/404 apart. */
const toWorkLogError = (error: unknown) => {
  const response = (error as TAxiosLikeError | undefined)?.response;
  const data = response?.data;
  return { ...(data && typeof data === "object" ? data : {}), status: response?.status };
};

export class IssueWorkLogService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  /** Every time entry of one work item, newest first. */
  async list(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueWorkLog[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklogs/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw toWorkLogError(error);
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
        throw toWorkLogError(error);
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
        throw toWorkLogError(error);
      });
  }

  async remove(workspaceSlug: string, projectId: string, issueId: string, workLogId: string): Promise<void> {
    return this.delete(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklogs/${workLogId}/`
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw toWorkLogError(error);
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
        throw toWorkLogError(error);
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
        throw toWorkLogError(error);
      });
  }
}
