/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: project target date rules (`IProject.target_date`).

import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
// local imports
import { getDate } from "../datetime";

/**
 * @description whether an active project's target date is overdue. Same rule as Plane's
 * `shouldHighlightIssueDueDate` for work items: due today (browser local date) already counts.
 * @param {string | Date | null | undefined} date the project's `target_date` ("YYYY-MM-DD")
 * @param {boolean} isArchived archived projects are never overdue
 * @returns {boolean}
 */
export const isProjectTargetDateOverdue = (date: string | Date | null | undefined, isArchived: boolean): boolean => {
  if (!date || isArchived) return false;
  const parsedDate = getDate(date);
  if (!parsedDate) return false;
  return differenceInCalendarDays(parsedDate, new Date()) <= 0;
};
