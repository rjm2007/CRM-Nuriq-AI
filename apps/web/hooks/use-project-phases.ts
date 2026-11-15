/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: load a project's phases once (shared SWR key) and read them from the phase store (Step 2).

import useSWR from "swr";
// plane imports
import { PROJECT_PHASES_SWR_KEY } from "@plane/constants";
import type { IPhase } from "@plane/types";
// hooks
import { usePhase } from "@/hooks/store/use-phase";

type TProjectPhases = {
  /** Phases in sequence order; `undefined` until the first fetch finished. */
  phases: IPhase[] | undefined;
  isLoading: boolean;
  /** The fetch failed (e.g. no access or the endpoint is missing). */
  hasError: boolean;
};

/**
 * Fetches the phases of `projectId` (deduped app-wide through `PROJECT_PHASES_SWR_KEY`) and returns
 * them from the store. Call inside an `observer` so the list re-renders on store changes.
 */
export const useProjectPhases = (
  workspaceSlug: string | undefined | null,
  projectId: string | undefined | null
): TProjectPhases => {
  const { fetchPhases, getProjectPhases } = usePhase();
  const { isLoading, error } = useSWR(
    workspaceSlug && projectId ? PROJECT_PHASES_SWR_KEY(projectId) : null,
    workspaceSlug && projectId ? () => fetchPhases(workspaceSlug, projectId) : null,
    { revalidateIfStale: false, revalidateOnFocus: false }
  );
  return { phases: getProjectPhases(projectId), isLoading, hasError: !!error };
};
