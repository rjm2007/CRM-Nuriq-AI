/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: project phases (Step 2) and keyword-map relations.

/** SWR key for a project's phases. One key app-wide so every caller shares the same request. */
export const PROJECT_PHASES_SWR_KEY = (projectId: string) => `PROJECT_PHASES_${projectId}`;

/** SWR key for a project's keyword-map relations (ModuleRelation). */
export const PROJECT_MODULE_RELATIONS_SWR_KEY = (projectId: string) => `PROJECT_MODULE_RELATIONS_${projectId}`;

/** Gap between phase sequences, same default as Plane states (`getCurrentStateSequence`). */
export const PHASE_SEQUENCE_GAP = 65535;

/** Max phase name length (backend `Phase.name` max_length). */
export const PHASE_NAME_MAX_LENGTH = 255;
