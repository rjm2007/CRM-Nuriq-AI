/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: time tracking (IssueWorkLog) helpers. Named `*WorkLogDuration` because `formatDuration`
// (seconds -> "1 hr 1 min") already exists in `datetime.ts`.

import { EUserPermissions } from "@plane/constants";
import type { TIssueWorkLog } from "@plane/types";

/** Smallest and largest duration of one time entry, in minutes (API: 1..1440). */
export const WORKLOG_MIN_MINUTES = 1;
export const WORKLOG_MAX_MINUTES = 1440;

/** API `error_code`s the worklog endpoints return. */
export const WORKLOG_ERROR_CODES = [
  "TIME_TRACKING_DISABLED",
  "INVALID_WORKLOG_USER",
  "WORKLOG_ISSUE_IMMUTABLE",
] as const;
export type TWorkLogErrorCode = (typeof WORKLOG_ERROR_CODES)[number];

/**
 * Minutes -> "1h 30m", "2h", "45m". Zero, negative or non-finite input gives "0m".
 * Hours are not folded into days (a work item can collect more than 24h).
 */
export const formatWorkLogDuration = (minutes: number | null | undefined): string => {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return "0m";
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
};

const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
const HOURS_UNIT = String.raw`h(?:ours?|rs?)?`;
const MINUTES_UNIT = String.raw`m(?:in(?:ute)?s?)?`;
// "1h 30m", "1h30", "1.5h", "90m", "2 hours 5 mins"
const UNIT_PATTERN = new RegExp(String.raw`^(?:${NUMBER}\s*${HOURS_UNIT})?\s*(?:${NUMBER}\s*(?:${MINUTES_UNIT})?)?$`);
const CLOCK_PATTERN = /^(\d+):([0-5]\d)$/;
const PLAIN_MINUTES_PATTERN = /^\d+$/;

const toNumber = (value: string) => Number(value.replace(",", "."));

/**
 * Parses what people type into a duration field, in minutes (rounded to the nearest minute).
 * Accepts "1h 30m", "1h30", "1:30", "90m", "1.5h", "1,5h" and a bare whole number of minutes ("90").
 * Returns `undefined` for anything else (empty, "abc", "1:75", "1.5" without a unit...).
 * The range (1..1440) is checked by the caller, see `isValidWorkLogDuration`.
 */
export const parseWorkLogDuration = (input: string | null | undefined): number | undefined => {
  const text = (input ?? "").trim().toLowerCase();
  if (!text) return undefined;

  if (PLAIN_MINUTES_PATTERN.test(text)) return Number(text);

  const clock = CLOCK_PATTERN.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  const match = UNIT_PATTERN.exec(text);
  if (!match) return undefined;
  const [, hoursText, minutesText] = match;
  if (hoursText === undefined && minutesText === undefined) return undefined;
  // A bare number after the hours ("1h30") is minutes; a bare number alone was handled above, so a
  // lone decimal without a unit ("1.5") lands here with no hours part and is rejected.
  if (hoursText === undefined && !/m/.test(text)) return undefined;
  const hours = hoursText ? toNumber(hoursText) : 0;
  const minutes = minutesText ? toNumber(minutesText) : 0;
  const total = Math.round(hours * 60 + minutes);
  return Number.isFinite(total) ? total : undefined;
};

/** True when `minutes` is a whole number of minutes the API accepts for one entry. */
export const isValidWorkLogDuration = (minutes: number | null | undefined): minutes is number =>
  typeof minutes === "number" &&
  Number.isInteger(minutes) &&
  minutes >= WORKLOG_MIN_MINUTES &&
  minutes <= WORKLOG_MAX_MINUTES;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads `error_code` (a string or a one-item list) from a worklog API error body. */
export const getWorkLogErrorCode = (error: unknown): TWorkLogErrorCode | undefined => {
  if (!isRecord(error)) return undefined;
  const raw = Array.isArray(error.error_code) ? error.error_code[0] : error.error_code;
  return typeof raw === "string" && (WORKLOG_ERROR_CODES as readonly string[]).includes(raw)
    ? (raw as TWorkLogErrorCode)
    : undefined;
};

/** Project ADMIN and MEMBER may log time; guests may not. */
export const canLogWork = (role: EUserPermissions | number | null | undefined): boolean =>
  typeof role === "number" && role >= EUserPermissions.MEMBER;

/** Members edit/delete entries logged for themselves; project admins edit/delete any entry. */
export const canManageWorkLog = (
  entry: Pick<TIssueWorkLog, "user">,
  currentUserId: string | null | undefined,
  role: EUserPermissions | number | null | undefined
): boolean => {
  if (!canLogWork(role)) return false;
  if (role === EUserPermissions.ADMIN) return true;
  return !!currentUserId && entry.user === currentUserId;
};
