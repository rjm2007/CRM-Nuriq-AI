/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { layout, route } from "@react-router/dev/routes";
import type { RouteConfigEntry } from "@react-router/dev/routes";

/**
 * Neuric routes. `mergeRoutes` (./helper.ts) deep-merges layouts by file, so each route repeats the
 * layout chain it lives under in `core.ts`; only the new leaf is added.
 */
export const extendedRoutes: RouteConfigEntry[] = [
  layout("./(all)/layout.tsx", [
    layout("./(all)/[workspaceSlug]/layout.tsx", [
      layout("./(all)/[workspaceSlug]/(settings)/layout.tsx", [
        layout("./(all)/[workspaceSlug]/(settings)/settings/projects/layout.tsx", [
          layout("./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/layout.tsx", [
            // Project feature: time tracking (IssueWorkLog)
            route(
              ":workspaceSlug/settings/projects/:projectId/features/time-tracking",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/features/time-tracking/page.tsx"
            ),
            // Project phases (Step 2)
            route(
              ":workspaceSlug/settings/projects/:projectId/phases",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/phases/page.tsx"
            ),
          ]),
        ]),
      ]),
    ]),
  ]),
];
