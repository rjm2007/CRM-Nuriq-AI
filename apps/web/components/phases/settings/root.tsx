/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: phases settings list (Step 2). Modelled on project-states/root.tsx: admins create, edit, delete and
// reorder; admins and members put keywords into phases; guests read.

import { useCallback, useState } from "react";
import { observer } from "mobx-react";
import { Button } from "@makeplane/propel/components/button";
import { Icon } from "@makeplane/propel/components/icon";
import { AddOutline } from "@makeplane/propel/icons";
// plane imports
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import { Loader } from "@plane/blocks/skeleton";
import { setToast } from "@plane/blocks/toast";
import { EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EUserProjectRoles } from "@plane/types";
import type { TPhaseApiError } from "@plane/types";
import { getPhaseDropSequence } from "@plane/utils";
// hooks
import { usePhase } from "@/hooks/store/use-phase";
import { useUserPermissions } from "@/hooks/store/user";
import { useProjectPhases } from "@/hooks/use-project-phases";
// local imports
import { PhaseForm } from "./phase-form";
import type { TPhaseFormValues } from "./phase-form";
import { PhaseItem } from "./phase-item";

type TPhaseSettingsRoot = {
  workspaceSlug: string;
  projectId: string;
};

/** First field message of an API 400 (`{ name: ["..."] }`), if any. */
const getFirstFieldMessage = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") return undefined;
  for (const [key, value] of Object.entries(error as TPhaseApiError)) {
    if (key === "status" || key === "error_code") continue;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    if (typeof value === "string") return value;
  }
  return undefined;
};

export const PhaseSettingsRoot = observer(function PhaseSettingsRoot(props: TPhaseSettingsRoot) {
  const { workspaceSlug, projectId } = props;
  const { t } = useTranslation();
  const { allowPermissions } = useUserPermissions();
  const { createPhase, updatePhase, deletePhase, movePhase, fetchPhases } = usePhase();
  const { phases, hasError } = useProjectPhases(workspaceSlug, projectId);
  const [isCreating, setIsCreating] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  // derived values
  const isEditable = allowPermissions(
    [EUserProjectRoles.ADMIN],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );
  const canAssign = allowPermissions(
    [EUserProjectRoles.ADMIN, EUserProjectRoles.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );

  const showError = useCallback(
    (error: unknown, fallbackKey: string) =>
      setToast({ type: "error", title: t("toast.error"), message: getFirstFieldMessage(error) ?? t(fallbackKey) }),
    [t]
  );

  const handleCreate = async (values: TPhaseFormValues) => {
    try {
      await createPhase(workspaceSlug, projectId, values);
      setToast({ type: "success", title: t("toast.success"), message: t("project_settings.phases.toast.created") });
      setIsCreating(false);
    } catch (error) {
      showError(error, "project_settings.phases.toast.create_error");
      throw error;
    }
  };

  const handleUpdate = async (phaseId: string, values: TPhaseFormValues) => {
    try {
      await updatePhase(workspaceSlug, projectId, phaseId, values);
      setToast({ type: "success", title: t("toast.success"), message: t("project_settings.phases.toast.updated") });
    } catch (error) {
      showError(error, "project_settings.phases.toast.update_error");
      throw error;
    }
  };

  const handleDelete = async (phaseId: string) => {
    try {
      await deletePhase(workspaceSlug, projectId, phaseId);
      setToast({ type: "success", title: t("toast.success"), message: t("project_settings.phases.toast.deleted") });
    } catch (error) {
      showError(error, "project_settings.phases.toast.delete_error");
      throw error;
    }
  };

  const handleDrop = useCallback(
    (sourceId: string, targetId: string, edge: "top" | "bottom" | null) => {
      if (!phases || sourceId === targetId) return;
      const sequence = getPhaseDropSequence(phases, targetId, edge);
      if (sequence === undefined) return;
      movePhase(workspaceSlug, projectId, sourceId, sequence).catch((error: unknown) =>
        showError(error, "project_settings.phases.toast.reorder_error")
      );
    },
    [phases, movePhase, workspaceSlug, projectId, showError]
  );

  /** Menu "Move up" / "Move down": the same drop logic as dragging onto the neighbour's top / bottom edge. */
  const handleMove = useCallback(
    (phaseId: string, direction: "up" | "down") => {
      if (!phases) return;
      const index = phases.findIndex((phase) => phase.id === phaseId);
      const neighbour = phases[direction === "up" ? index - 1 : index + 1];
      if (index < 0 || !neighbour) return;
      handleDrop(phaseId, neighbour.id, direction === "up" ? "top" : "bottom");
    },
    [phases, handleDrop]
  );

  /** A successful re-fetch marks the project fetched, so `phases` is set and the list replaces this state. */
  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await fetchPhases(workspaceSlug, projectId);
    } catch {
      setToast({ type: "error", title: t("toast.error"), message: t("project_settings.phases.load_error") });
    } finally {
      setIsRetrying(false);
    }
  };

  if (!phases && hasError)
    return (
      <EmptyStateCompact
        title={t("project_settings.phases.load_error")}
        className="py-8"
        actions={[
          {
            label: t("common.retry"),
            onClick: () => void handleRetry(),
            variant: "secondary",
            loading: isRetrying,
            disabled: isRetrying,
            "data-testid": "phase-load-retry",
          },
        ]}
      />
    );

  if (!phases)
    return (
      <Loader className="flex flex-col gap-2">
        <Loader.Item height="72px" />
        <Loader.Item height="72px" />
      </Loader>
    );

  return (
    <div className="flex flex-col gap-3" data-testid="phase-settings">
      <div className="flex items-center justify-between gap-2">
        <span className="text-body-sm-medium text-primary">
          {t("project_settings.phases.count", { count: phases.length })}
        </span>
        {isEditable && (
          <Button
            variant="secondary"
            size="md"
            stretch="auto"
            label={t("project_settings.phases.add")}
            icon={<Icon icon={AddOutline} />}
            disabled={isCreating}
            onClick={() => setIsCreating(true)}
            data-testid="phase-add-button"
          />
        )}
      </div>

      {!isEditable && <p className="text-body-xs-regular text-tertiary">{t("project_settings.phases.admin_only")}</p>}

      {phases.length === 0 && !isCreating && (
        <EmptyStateCompact
          assetKey="state"
          title={t("project_settings.phases.empty_state.title")}
          description={t("project_settings.phases.empty_state.description")}
          className="py-8"
          actions={
            isEditable
              ? [{ label: t("project_settings.phases.add"), onClick: () => setIsCreating(true), variant: "primary" }]
              : undefined
          }
        />
      )}

      <div className="flex flex-col gap-1.5">
        {phases.map((phase, index) => (
          <PhaseItem
            key={phase.id}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            phase={phase}
            isEditable={isEditable}
            canAssign={canAssign}
            isDraggable={phases.length > 1}
            canMoveUp={index > 0}
            canMoveDown={index < phases.length - 1}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onDrop={handleDrop}
            onMove={handleMove}
          />
        ))}
      </div>

      {isEditable && isCreating && (
        <PhaseForm
          onSubmit={handleCreate}
          onCancel={() => setIsCreating(false)}
          submitLabel={t("project_settings.phases.form.create")}
          submittingLabel={t("creating")}
        />
      )}
    </div>
  );
});
