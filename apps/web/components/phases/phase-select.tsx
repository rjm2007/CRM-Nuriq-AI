/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: web bindings for the `PhaseSelect` block (Step 2). A keyword (Plane `Module`) is in at most one phase.

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { PhaseSelect } from "@plane/blocks/property-select";
import type { PhaseOption } from "@plane/blocks/property-select";
import type { SelectVariant } from "@plane/blocks/select";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
// hooks
import { usePhase } from "@/hooks/store/use-phase";
import { useProjectPhases } from "@/hooks/use-project-phases";

type TProjectPhaseSelectProps = {
  workspaceSlug: string;
  /** Project whose phases are offered. */
  projectId: string | undefined | null;
  /** Selected phase id, or `null`. */
  value: string | null;
  onChange: (phaseId: string | null) => void;
  variant: SelectVariant;
  disabled?: boolean;
  className?: string;
  tabIndex?: number;
  testId?: string;
};

/** Controlled phase picker fed from the phase store (used by the keyword create/edit form). */
export const ProjectPhaseSelect = observer(function ProjectPhaseSelect(props: TProjectPhaseSelectProps) {
  const { workspaceSlug, projectId, value, onChange, variant, disabled, className, tabIndex, testId } = props;
  const { t } = useTranslation();
  const { phases } = useProjectPhases(workspaceSlug, projectId);
  const options: PhaseOption[] = (phases ?? []).map((phase) => ({ id: phase.id, name: phase.name }));

  return (
    <PhaseSelect
      options={options}
      value={value}
      onChange={onChange}
      variant={variant}
      disabled={disabled}
      className={className}
      tabIndex={tabIndex}
      testId={testId}
      placeholder={t("phase.label")}
      searchPlaceholder={t("phase.search")}
      missingLabel={t("phase.missing")}
      emptyMessage={t("phase.empty_options")}
      clearable
      clearLabel={t("phase.no_phase")}
      tooltip={{ heading: t("phase.label"), emptyContent: t("phase.no_phase") }}
    />
  );
});

type TModulePhaseSelectProps = {
  workspaceSlug: string;
  projectId: string;
  /** Keyword (module) whose phase is shown and changed. */
  moduleId: string;
  variant: SelectVariant;
  disabled?: boolean;
  className?: string;
  testId?: string;
};

/** Phase picker bound to one keyword: picking a phase moves the keyword there right away (sidebar / peek). */
export const ModulePhaseSelect = observer(function ModulePhaseSelect(props: TModulePhaseSelectProps) {
  const { workspaceSlug, projectId, moduleId, variant, disabled, className, testId } = props;
  const { t } = useTranslation();
  const { getPhaseIdByModuleId, setModulePhase } = usePhase();
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (phaseId: string | null) => {
    setIsSaving(true);
    try {
      await setModulePhase(workspaceSlug, projectId, moduleId, phaseId);
    } catch {
      setToast({ type: "error", title: t("toast.error"), message: t("phase.toast.keyword_error") });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProjectPhaseSelect
      workspaceSlug={workspaceSlug}
      projectId={projectId}
      value={getPhaseIdByModuleId(moduleId) ?? null}
      onChange={(phaseId) => void handleChange(phaseId)}
      variant={variant}
      disabled={disabled || isSaving}
      className={className}
      testId={testId}
    />
  );
});
