/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: Phase (ordered stage of a project) and ModuleRelation (directed keyword-map edge).
// Shapes match apps/api serializers for `/api/workspaces/<slug>/projects/<id>/phases/` and `module-relations/`.

/** A project phase. Keywords (Plane `Module`) belong to at most one phase. */
export interface IPhase {
  id: string;
  name: string;
  description: string;
  /** Sort key, ascending. Float so a drop between two phases can take the midpoint. */
  sequence: number;
  start_date: string | null;
  target_date: string | null;
  /** Keyword (module) ids in this phase, in display order. */
  module_ids: string[];
  /** Project id. */
  project: string;
  created_at: string;
  updated_at: string;
}

/** Body for `POST phases/` and `PATCH phases/<id>/`. */
export type TPhasePayload = {
  name?: string;
  description?: string;
  start_date?: string | null;
  target_date?: string | null;
  sequence?: number;
};

/** Body for `POST phases/<id>/modules/`: moves these keywords into the phase (out of any old one). */
export type TPhaseModulesPayload = {
  module_ids: string[];
};

/** A directed edge between two keywords on the keyword map. */
export interface IModuleRelation {
  id: string;
  source_module: string;
  target_module: string;
  /** Free text, may be empty. */
  label: string;
}

/** Body for `POST module-relations/` and `PATCH module-relations/<id>/`. */
export type TModuleRelationPayload = {
  source_module?: string;
  target_module?: string;
  label?: string;
};

/** API validation error: `{ field: [message], error_code }` (400). */
export type TPhaseApiError = {
  error_code?: string;
  status?: number;
} & Record<string, unknown>;
