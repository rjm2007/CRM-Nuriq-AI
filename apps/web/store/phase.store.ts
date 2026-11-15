/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: project phases + keyword-map relations (Step 2). A keyword (Plane `Module`) is in at most one
// phase; a work item's phase is derived from its keywords (no `Issue.phase` field).

import { set, sortBy } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// plane imports
import { PHASE_SEQUENCE_GAP } from "@plane/constants";
import type { IModuleRelation, IPhase, TModuleRelationPayload, TPhaseApiError, TPhasePayload } from "@plane/types";
// services
import { PhaseService } from "@/services/phase.service";
// store
import type { CoreRootStore } from "./root.store";

const sortPhases = (phases: IPhase[]) => sortBy(phases, ["sequence", "created_at"]);

/** `PhaseService` errors carry the HTTP `status` (see `toPhaseError`). */
const isForbidden = (error: unknown) => (error as TPhaseApiError | undefined)?.status === 403;

export interface IPhaseStore {
  // observables
  phasesMap: Record<string, IPhase>;
  /** projectId -> true once the phases of that project were fetched. */
  fetchedMap: Record<string, boolean>;
  /** projectId -> true when the phases list answered 403 (guest without "view all features"): phases are hidden. */
  forbiddenMap: Record<string, boolean>;
  // computed
  /** Phase ids of the project in the URL, by sequence; `undefined` until fetched. */
  projectPhaseIds: string[] | undefined;
  /** keyword (module) id -> phase id, across every loaded phase. */
  moduleIdToPhaseId: Record<string, string>;
  // computed actions
  getProjectPhaseIds: (projectId: string | undefined | null) => string[] | undefined;
  getProjectPhases: (projectId: string | undefined | null) => IPhase[] | undefined;
  getPhaseById: (phaseId: string | undefined | null) => IPhase | undefined;
  getPhaseIdByModuleId: (moduleId: string | undefined | null) => string | undefined;
  /** The user may not read this project's phases (API 403); UI hides phase rows instead of showing an error. */
  isPhasesForbidden: (projectId: string | undefined | null) => boolean;
  /** Distinct phase names of these keywords, in phase order (a work item in two keywords may have two phases). */
  getPhaseNamesByModuleIds: (moduleIds: string[] | undefined | null) => string[];
  // actions
  /** A 403 resolves to `[]` and sets `forbiddenMap`; other errors are thrown. */
  fetchPhases: (workspaceSlug: string, projectId: string) => Promise<IPhase[]>;
  createPhase: (workspaceSlug: string, projectId: string, data: TPhasePayload) => Promise<IPhase>;
  updatePhase: (workspaceSlug: string, projectId: string, phaseId: string, data: TPhasePayload) => Promise<IPhase>;
  deletePhase: (workspaceSlug: string, projectId: string, phaseId: string) => Promise<void>;
  /** Moves a phase to `sequence` (optimistic; rolled back on error). */
  movePhase: (workspaceSlug: string, projectId: string, phaseId: string, sequence: number) => Promise<void>;
  /** Puts keywords into a phase, moving them out of their old phase (optimistic; on error only these keywords go back, then a re-fetch). */
  assignModules: (workspaceSlug: string, projectId: string, phaseId: string, moduleIds: string[]) => Promise<void>;
  /** Takes one keyword out of a phase (optimistic; on error only this keyword goes back, then a re-fetch). */
  removeModule: (workspaceSlug: string, projectId: string, phaseId: string, moduleId: string) => Promise<void>;
  /** One call for pickers: `phaseId` null removes the keyword from its current phase. */
  setModulePhase: (workspaceSlug: string, projectId: string, moduleId: string, phaseId: string | null) => Promise<void>;
}

export interface IModuleRelationStore {
  // observables
  relationsMap: Record<string, IModuleRelation>;
  /** projectId -> relation ids (the API returns relations per project). */
  projectRelationIds: Record<string, string[]>;
  // computed actions
  getProjectRelations: (projectId: string | undefined | null) => IModuleRelation[] | undefined;
  getRelationById: (relationId: string) => IModuleRelation | undefined;
  // actions
  fetchRelations: (workspaceSlug: string, projectId: string) => Promise<IModuleRelation[]>;
  createRelation: (workspaceSlug: string, projectId: string, data: TModuleRelationPayload) => Promise<IModuleRelation>;
  updateRelation: (
    workspaceSlug: string,
    projectId: string,
    relationId: string,
    data: TModuleRelationPayload
  ) => Promise<IModuleRelation>;
  deleteRelation: (workspaceSlug: string, projectId: string, relationId: string) => Promise<void>;
}

export class PhaseStore implements IPhaseStore {
  phasesMap: Record<string, IPhase> = {};
  fetchedMap: Record<string, boolean> = {};
  forbiddenMap: Record<string, boolean> = {};
  // root store
  rootStore: CoreRootStore;
  // services
  phaseService: PhaseService;

  constructor(rootStore: CoreRootStore) {
    makeObservable(this, {
      phasesMap: observable,
      fetchedMap: observable,
      forbiddenMap: observable,
      projectPhaseIds: computed,
      moduleIdToPhaseId: computed,
      fetchPhases: action,
      createPhase: action,
      updatePhase: action,
      deletePhase: action,
      movePhase: action,
      assignModules: action,
      removeModule: action,
      setModulePhase: action,
    });
    this.rootStore = rootStore;
    this.phaseService = new PhaseService();
  }

  get projectPhaseIds() {
    return this.getProjectPhaseIds(this.rootStore.router.projectId);
  }

  get moduleIdToPhaseId() {
    const map: Record<string, string> = {};
    Object.values(this.phasesMap).forEach((phase) => {
      phase.module_ids?.forEach((moduleId) => {
        map[moduleId] = phase.id;
      });
    });
    return map;
  }

  getProjectPhases = computedFn((projectId: string | undefined | null) => {
    if (!projectId || !this.fetchedMap[projectId]) return undefined;
    return sortPhases(Object.values(this.phasesMap).filter((phase) => phase.project === projectId));
  });

  getProjectPhaseIds = computedFn(
    (projectId: string | undefined | null) => this.getProjectPhases(projectId)?.map((phase) => phase.id) ?? undefined
  );

  getPhaseById = computedFn((phaseId: string | undefined | null) => (phaseId ? this.phasesMap[phaseId] : undefined));

  getPhaseIdByModuleId = computedFn((moduleId: string | undefined | null) =>
    moduleId ? this.moduleIdToPhaseId[moduleId] : undefined
  );

  isPhasesForbidden = computedFn((projectId: string | undefined | null) =>
    projectId ? !!this.forbiddenMap[projectId] : false
  );

  getPhaseNamesByModuleIds = computedFn((moduleIds: string[] | undefined | null) => {
    if (!moduleIds?.length) return [];
    const phaseIds = new Set<string>();
    moduleIds.forEach((moduleId) => {
      const phaseId = this.moduleIdToPhaseId[moduleId];
      if (phaseId) phaseIds.add(phaseId);
    });
    return sortPhases(
      Array.from(phaseIds)
        .map((phaseId) => this.phasesMap[phaseId])
        .filter((phase): phase is IPhase => !!phase)
    ).map((phase) => phase.name);
  });

  fetchPhases = async (workspaceSlug: string, projectId: string) => {
    let phases: IPhase[];
    let forbidden = false;
    try {
      phases = await this.phaseService.list(workspaceSlug, projectId);
    } catch (error) {
      // a guest of a project with guest_view_all_features off gets 403: quietly "no phases", not an error
      if (!isForbidden(error)) throw error;
      phases = [];
      forbidden = true;
    }
    runInAction(() => {
      // drop phases of this project that are gone on the server
      Object.values(this.phasesMap).forEach((phase) => {
        if (phase.project === projectId) delete this.phasesMap[phase.id];
      });
      phases.forEach((phase) => set(this.phasesMap, [phase.id], { ...phase, project: phase.project ?? projectId }));
      set(this.fetchedMap, [projectId], true);
      set(this.forbiddenMap, [projectId], forbidden);
    });
    return phases;
  };

  createPhase = async (workspaceSlug: string, projectId: string, data: TPhasePayload) => {
    const payload: TPhasePayload = { ...data };
    if (payload.sequence === undefined) {
      const last = this.getProjectPhases(projectId)?.at(-1);
      payload.sequence = (last?.sequence ?? 0) + PHASE_SEQUENCE_GAP;
    }
    const phase = await this.phaseService.create(workspaceSlug, projectId, payload);
    runInAction(() => {
      set(this.phasesMap, [phase.id], {
        ...phase,
        module_ids: phase.module_ids ?? [],
        project: phase.project ?? projectId,
      });
    });
    return phase;
  };

  updatePhase = async (workspaceSlug: string, projectId: string, phaseId: string, data: TPhasePayload) => {
    const phase = await this.phaseService.update(workspaceSlug, projectId, phaseId, data);
    runInAction(() => {
      const current = this.phasesMap[phaseId];
      set(this.phasesMap, [phaseId], {
        ...current,
        ...phase,
        module_ids: phase.module_ids ?? current?.module_ids ?? [],
      });
    });
    return phase;
  };

  deletePhase = async (workspaceSlug: string, projectId: string, phaseId: string) => {
    await this.phaseService.remove(workspaceSlug, projectId, phaseId);
    runInAction(() => {
      delete this.phasesMap[phaseId];
    });
  };

  movePhase = async (workspaceSlug: string, projectId: string, phaseId: string, sequence: number) => {
    const phase = this.phasesMap[phaseId];
    if (!phase || phase.sequence === sequence) return;
    const oldSequence = phase.sequence;
    runInAction(() => set(this.phasesMap, [phaseId, "sequence"], sequence));
    try {
      await this.phaseService.update(workspaceSlug, projectId, phaseId, { sequence });
    } catch (error) {
      runInAction(() => {
        if (this.phasesMap[phaseId]) set(this.phasesMap, [phaseId, "sequence"], oldSequence);
      });
      throw error;
    }
  };

  /** Writes a new `module_ids` array (never mutates in place, so every observer of the phase recomputes). */
  private setPhaseModuleIds(phaseId: string, moduleIds: string[]) {
    if (this.phasesMap[phaseId]) set(this.phasesMap, [phaseId, "module_ids"], moduleIds);
  }

  /**
   * Undo of a failed keyword move: only the keywords of that request go back to where they were, so a parallel
   * change that succeeded is kept. Then the project's phases are re-fetched to match the server.
   */
  private rollbackModules(
    workspaceSlug: string,
    projectId: string,
    previousPhaseIds: Record<string, string | undefined>
  ) {
    runInAction(() => {
      Object.entries(previousPhaseIds).forEach(([moduleId, previousPhaseId]) => {
        Object.values(this.phasesMap).forEach((phase) => {
          if (phase.id !== previousPhaseId && phase.module_ids?.includes(moduleId))
            this.setPhaseModuleIds(
              phase.id,
              phase.module_ids.filter((id) => id !== moduleId)
            );
        });
        const previous = previousPhaseId ? this.phasesMap[previousPhaseId] : undefined;
        if (previous && !previous.module_ids?.includes(moduleId))
          this.setPhaseModuleIds(previous.id, [...(previous.module_ids ?? []), moduleId]);
      });
    });
    this.fetchPhases(workspaceSlug, projectId).catch(() => undefined);
  }

  assignModules = async (workspaceSlug: string, projectId: string, phaseId: string, moduleIds: string[]) => {
    if (!this.phasesMap[phaseId] || moduleIds.length === 0) return;
    const previousPhaseIds: Record<string, string | undefined> = {};
    moduleIds.forEach((moduleId) => {
      previousPhaseIds[moduleId] = this.moduleIdToPhaseId[moduleId];
    });
    runInAction(() => {
      // one phase per keyword: take the keywords out of every other phase first
      Object.values(this.phasesMap).forEach((phase) => {
        if (phase.id === phaseId || !phase.module_ids?.some((id) => moduleIds.includes(id))) return;
        this.setPhaseModuleIds(
          phase.id,
          phase.module_ids.filter((id) => !moduleIds.includes(id))
        );
      });
      const current = this.phasesMap[phaseId]?.module_ids ?? [];
      this.setPhaseModuleIds(phaseId, [...current, ...moduleIds.filter((id) => !current.includes(id))]);
    });
    try {
      await this.phaseService.addModules(workspaceSlug, projectId, phaseId, { module_ids: moduleIds });
    } catch (error) {
      this.rollbackModules(workspaceSlug, projectId, previousPhaseIds);
      throw error;
    }
  };

  removeModule = async (workspaceSlug: string, projectId: string, phaseId: string, moduleId: string) => {
    const phase = this.phasesMap[phaseId];
    if (!phase) return;
    runInAction(() =>
      this.setPhaseModuleIds(
        phaseId,
        (phase.module_ids ?? []).filter((id) => id !== moduleId)
      )
    );
    try {
      await this.phaseService.removeModule(workspaceSlug, projectId, phaseId, moduleId);
    } catch (error) {
      this.rollbackModules(workspaceSlug, projectId, { [moduleId]: phaseId });
      throw error;
    }
  };

  setModulePhase = async (workspaceSlug: string, projectId: string, moduleId: string, phaseId: string | null) => {
    const currentPhaseId = this.moduleIdToPhaseId[moduleId];
    if ((currentPhaseId ?? null) === phaseId) return;
    if (phaseId) await this.assignModules(workspaceSlug, projectId, phaseId, [moduleId]);
    else if (currentPhaseId) await this.removeModule(workspaceSlug, projectId, currentPhaseId, moduleId);
  };
}

export class ModuleRelationStore implements IModuleRelationStore {
  relationsMap: Record<string, IModuleRelation> = {};
  projectRelationIds: Record<string, string[]> = {};
  // services
  phaseService: PhaseService;

  constructor() {
    makeObservable(this, {
      relationsMap: observable,
      projectRelationIds: observable,
      fetchRelations: action,
      createRelation: action,
      updateRelation: action,
      deleteRelation: action,
    });
    this.phaseService = new PhaseService();
  }

  getProjectRelations = computedFn((projectId: string | undefined | null) => {
    if (!projectId) return undefined;
    const ids = this.projectRelationIds[projectId];
    if (!ids) return undefined;
    return ids.map((id) => this.relationsMap[id]).filter((relation): relation is IModuleRelation => !!relation);
  });

  getRelationById = computedFn((relationId: string) => this.relationsMap[relationId]);

  fetchRelations = async (workspaceSlug: string, projectId: string) => {
    let relations: IModuleRelation[];
    try {
      relations = await this.phaseService.listRelations(workspaceSlug, projectId);
    } catch (error) {
      // same as phases: a 403 (guest without "view all features") means "no relations", not an error
      if (!isForbidden(error)) throw error;
      relations = [];
    }
    runInAction(() => {
      (this.projectRelationIds[projectId] ?? []).forEach((id) => delete this.relationsMap[id]);
      relations.forEach((relation) => set(this.relationsMap, [relation.id], relation));
      set(
        this.projectRelationIds,
        [projectId],
        relations.map((relation) => relation.id)
      );
    });
    return relations;
  };

  createRelation = async (workspaceSlug: string, projectId: string, data: TModuleRelationPayload) => {
    const relation = await this.phaseService.createRelation(workspaceSlug, projectId, data);
    runInAction(() => {
      set(this.relationsMap, [relation.id], relation);
      set(this.projectRelationIds, [projectId], [...(this.projectRelationIds[projectId] ?? []), relation.id]);
    });
    return relation;
  };

  updateRelation = async (
    workspaceSlug: string,
    projectId: string,
    relationId: string,
    data: TModuleRelationPayload
  ) => {
    const relation = await this.phaseService.updateRelation(workspaceSlug, projectId, relationId, data);
    runInAction(() => set(this.relationsMap, [relationId], { ...this.relationsMap[relationId], ...relation }));
    return relation;
  };

  deleteRelation = async (workspaceSlug: string, projectId: string, relationId: string) => {
    await this.phaseService.removeRelation(workspaceSlug, projectId, relationId);
    runInAction(() => {
      delete this.relationsMap[relationId];
      set(
        this.projectRelationIds,
        [projectId],
        (this.projectRelationIds[projectId] ?? []).filter((id) => id !== relationId)
      );
    });
  };
}
