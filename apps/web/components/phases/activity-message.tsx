/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: text of a work item `phase` activity row (Step 2). Written by apps/api/plane/bgtasks/phase_activity.py
// when one of the work item's keywords joins, leaves or moves phase: old/new value = phase names.
// Shared by the work item Activity tab and the profile / workspace activity feeds (`components/core/activity.tsx`).

import type { ReactNode } from "react";
import { useTranslation } from "@plane/i18n";
import { getPhaseActivityKind } from "@plane/utils";

type TPhaseActivityFields = {
  old_value?: string | null;
  new_value?: string | null;
};

/** Stand-in for `{item}`; the translated text is split on it so the work item link can sit where the locale wants. */
const ITEM_TOKEN = "\u0000item\u0000";

const MESSAGE_KEYS = {
  moved: "phase.activity.moved",
  added: "phase.activity.added",
  removed: "phase.activity.removed",
  updated: "phase.activity.updated",
} as const;

const FEED_KEYS = {
  moved: "phase.activity.moved_feed",
  added: "phase.activity.added_feed",
  removed: "phase.activity.removed_feed",
  updated: "phase.activity.updated_feed",
} as const;

/**
 * "moved this work item from phase A to phase B", ... Pass `item` (the work item link) for the profile / workspace
 * feeds: the `*_feed` texts name the work item instead of saying "this work item".
 */
export function PhaseActivityMessage(props: { activity: TPhaseActivityFields; item?: ReactNode }) {
  const { activity, item } = props;
  const { t } = useTranslation();

  const kind = getPhaseActivityKind(activity) ?? "updated";
  const params = { from: activity.old_value ?? "", to: activity.new_value ?? "" };
  if (!item) return <>{t(MESSAGE_KEYS[kind], params)}</>;

  // every locale has exactly one `{item}`; anything after a second token would stay as plain text
  const [before, ...after] = t(FEED_KEYS[kind], { ...params, item: ITEM_TOKEN }).split(ITEM_TOKEN);
  return (
    <>
      {before}
      {item}
      {after.join("")}
    </>
  );
}
