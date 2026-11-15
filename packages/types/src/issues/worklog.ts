/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: time tracking (IssueWorkLog). Mirrors `apps/api/plane/app/serializers/worklog.py`.

import type { IUserLite } from "../users";

/** One time entry on a work item. `duration_minutes` is 1..1440. */
export type TIssueWorkLog = {
  id: string;
  issue: string;
  project?: string;
  workspace?: string;
  /** The member the time is logged for (may differ from `created_by` when an admin logs for someone). */
  user: string;
  user_detail?: IUserLite;
  /** ISO datetime. */
  started_at: string;
  duration_minutes: number;
  note: string;
  created_by: string;
  created_by_detail?: IUserLite;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

/** Create/update body. `user` is only accepted from project admins (log for another member). */
export type TIssueWorkLogPayload = {
  started_at: string;
  duration_minutes: number;
  note?: string;
  user?: string;
};

/** `GET .../projects/{project_id}/worklogs/summary/` */
export type TWorkLogSummary = {
  total_minutes: number;
  by_user: { user_id: string; minutes: number }[];
};

/** Query params of the project worklog list and summary endpoints. */
export type TWorkLogFilters = {
  user?: string;
  issue?: string;
  started_at__gte?: string;
  started_at__lt?: string;
  include_subtasks?: boolean;
  cursor?: string;
  per_page?: number;
};
