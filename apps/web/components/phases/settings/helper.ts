/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: display helpers for the phases settings page (Step 2).

import { renderFormattedDate } from "@plane/utils";

/** "Jan 05, 2026 – Feb 01, 2026", "Jan 05, 2026 – …", or `undefined` when neither date is set. */
export const formatPhaseDateRange = (start: string | null | undefined, end: string | null | undefined) => {
  const from = renderFormattedDate(start);
  const to = renderFormattedDate(end);
  if (!from && !to) return undefined;
  return `${from ?? "…"} – ${to ?? "…"}`;
};
