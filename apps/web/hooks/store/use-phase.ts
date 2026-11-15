/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: project phases + keyword-map relations (Step 2).

import { useContext } from "react";
// mobx store
import { StoreContext } from "@/lib/store-context";
// types
import type { IModuleRelationStore, IPhaseStore } from "@/store/phase.store";

export const usePhase = (): IPhaseStore => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error("usePhase must be used within StoreProvider");
  return context.phase;
};

export const useModuleRelation = (): IModuleRelationStore => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error("useModuleRelation must be used within StoreProvider");
  return context.moduleRelation;
};
