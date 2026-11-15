/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: project phases + keyword-map relations (Step 2). Backend: apps/api/plane/app/views (phase, module relation).

import { API_BASE_URL } from "@plane/constants";
import type {
  IModuleRelation,
  IPhase,
  TModuleRelationPayload,
  TPhaseApiError,
  TPhaseModulesPayload,
  TPhasePayload,
} from "@plane/types";
// services
import { APIService } from "@/services/api.service";

type TAxiosLikeError = { response?: { status?: number; data?: unknown } };

/** The API error body (`{ field: [msg], error_code }`) plus the HTTP `status`, so callers can tell 400/403 apart. */
const toPhaseError = (error: unknown): TPhaseApiError => {
  const response = (error as TAxiosLikeError | undefined)?.response;
  const data = response?.data;
  return { ...(data && typeof data === "object" ? data : {}), status: response?.status };
};

export class PhaseService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private base(workspaceSlug: string, projectId: string) {
    return `/api/workspaces/${workspaceSlug}/projects/${projectId}`;
  }

  // phases

  async list(workspaceSlug: string, projectId: string): Promise<IPhase[]> {
    return this.get(`${this.base(workspaceSlug, projectId)}/phases/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw toPhaseError(error);
      });
  }

  async create(workspaceSlug: string, projectId: string, data: TPhasePayload): Promise<IPhase> {
    return this.post(`${this.base(workspaceSlug, projectId)}/phases/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw toPhaseError(error);
      });
  }

  async update(workspaceSlug: string, projectId: string, phaseId: string, data: TPhasePayload): Promise<IPhase> {
    return this.patch(`${this.base(workspaceSlug, projectId)}/phases/${phaseId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw toPhaseError(error);
      });
  }

  async remove(workspaceSlug: string, projectId: string, phaseId: string): Promise<void> {
    return this.delete(`${this.base(workspaceSlug, projectId)}/phases/${phaseId}/`)
      .then(() => undefined)
      .catch((error) => {
        throw toPhaseError(error);
      });
  }

  /** Puts keywords into the phase; the API moves each one out of its old phase. */
  async addModules(
    workspaceSlug: string,
    projectId: string,
    phaseId: string,
    data: TPhaseModulesPayload
  ): Promise<unknown> {
    return this.post(`${this.base(workspaceSlug, projectId)}/phases/${phaseId}/modules/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw toPhaseError(error);
      });
  }

  async removeModule(workspaceSlug: string, projectId: string, phaseId: string, moduleId: string): Promise<void> {
    return this.delete(`${this.base(workspaceSlug, projectId)}/phases/${phaseId}/modules/${moduleId}/`)
      .then(() => undefined)
      .catch((error) => {
        throw toPhaseError(error);
      });
  }

  // keyword-map relations

  async listRelations(workspaceSlug: string, projectId: string): Promise<IModuleRelation[]> {
    return this.get(`${this.base(workspaceSlug, projectId)}/module-relations/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw toPhaseError(error);
      });
  }

  async createRelation(
    workspaceSlug: string,
    projectId: string,
    data: TModuleRelationPayload
  ): Promise<IModuleRelation> {
    return this.post(`${this.base(workspaceSlug, projectId)}/module-relations/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw toPhaseError(error);
      });
  }

  async updateRelation(
    workspaceSlug: string,
    projectId: string,
    relationId: string,
    data: TModuleRelationPayload
  ): Promise<IModuleRelation> {
    return this.patch(`${this.base(workspaceSlug, projectId)}/module-relations/${relationId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw toPhaseError(error);
      });
  }

  async removeRelation(workspaceSlug: string, projectId: string, relationId: string): Promise<void> {
    return this.delete(`${this.base(workspaceSlug, projectId)}/module-relations/${relationId}/`)
      .then(() => undefined)
      .catch((error) => {
        throw toPhaseError(error);
      });
  }
}
