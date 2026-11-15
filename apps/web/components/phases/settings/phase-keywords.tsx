/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: keywords (Plane modules) inside one phase on the phases settings page (Step 2).

import { useCallback, useState } from "react";
import { observer } from "mobx-react";
import { Badge } from "@makeplane/propel/components/badge";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { CloseOutline, ModuleOutline, WarningCircleFilled } from "@makeplane/propel/icons";
// plane imports
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { IModule, IPhase } from "@plane/types";
import { isKeywordOutsidePhaseDates } from "@plane/utils";
// components
import { ModuleSelect } from "@/components/dropdowns/module/module-select";
// hooks
import { useModule } from "@/hooks/store/use-module";
import { usePhase } from "@/hooks/store/use-phase";
// local imports
import { formatPhaseDateRange } from "./helper";

type TPhaseKeywords = {
  workspaceSlug: string;
  projectId: string;
  phase: IPhase;
  /** Project admins and members may add / remove keywords. */
  canAssign: boolean;
};

export const PhaseKeywords = observer(function PhaseKeywords(props: TPhaseKeywords) {
  const { workspaceSlug, projectId, phase, canAssign } = props;
  const { t } = useTranslation();
  const { getModuleById } = useModule();
  const { assignModules, removeModule, getPhaseIdByModuleId, getPhaseById } = usePhase();
  const [isSaving, setIsSaving] = useState(false);
  /** Keywords whose remove request is in flight (their remove button is disabled). */
  const [removingIds, setRemovingIds] = useState<string[]>([]);

  const keywords = (phase.module_ids ?? [])
    .map((moduleId) => getModuleById(moduleId))
    .filter((module): module is IModule => !!module);

  const outsideKeywords = keywords.filter((keyword) => isKeywordOutsidePhaseDates(phase, keyword));

  const showError = () => setToast({ type: "error", title: t("toast.error"), message: t("phase.toast.keyword_error") });

  /** Picker hint: the phase a keyword is in now, so moving it here from another phase is never a surprise. */
  const getKeywordPhaseHint = useCallback(
    (module: IModule) => {
      const currentPhase = getPhaseById(getPhaseIdByModuleId(module.id));
      return currentPhase ? `${t("phase.label")}: ${currentPhase.name}` : undefined;
    },
    [getPhaseById, getPhaseIdByModuleId, t]
  );

  /** The picker works in "add" mode (always empty): picked keywords move into this phase; chips remove them. */
  const handleAdd = async (moduleIds: string[]) => {
    const current = phase.module_ids ?? [];
    const added = moduleIds.filter((id) => !current.includes(id));
    if (!added.length) return;
    // keywords taken out of another phase, for the notice after the move
    const moved = added
      .map((moduleId) => ({ module: getModuleById(moduleId), from: getPhaseById(getPhaseIdByModuleId(moduleId)) }))
      .filter((item) => !!item.module && !!item.from && item.from.id !== phase.id);
    setIsSaving(true);
    try {
      await assignModules(workspaceSlug, projectId, phase.id, added);
      moved.forEach(({ module, from }) =>
        setToast({
          type: "info",
          title: t("project_settings.phases.toast.keyword_moved", { name: module?.name ?? "", from: from?.name ?? "" }),
        })
      );
    } catch {
      showError();
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (moduleId: string) => {
    if (removingIds.includes(moduleId)) return;
    setRemovingIds((ids) => [...ids, moduleId]);
    try {
      await removeModule(workspaceSlug, projectId, phase.id, moduleId);
    } catch {
      showError();
    } finally {
      setRemovingIds((ids) => ids.filter((id) => id !== moduleId));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5" data-testid="phase-keywords">
        {keywords.length === 0 && (
          <span className="text-body-xs-regular text-placeholder">{t("project_settings.phases.no_keywords")}</span>
        )}
        {keywords.map((keyword) => {
          const outside = isKeywordOutsidePhaseDates(phase, keyword);
          const dates = formatPhaseDateRange(keyword.start_date, keyword.target_date);
          const isRemoving = removingIds.includes(keyword.id);
          return (
            <span
              key={keyword.id}
              className="inline-flex max-w-full min-w-0 items-center gap-0.5"
              data-testid="phase-keyword-chip"
              aria-busy={isRemoving || undefined}
            >
              <Badge
                size="sm"
                variant="neutral"
                label={dates ? `${keyword.name} · ${dates}` : keyword.name}
                startIcon={<Icon icon={ModuleOutline} />}
                endIcon={
                  outside ? (
                    <WarningCircleFilled
                      className="size-3.5 shrink-0 text-warning-primary"
                      aria-hidden="true"
                      data-testid="phase-keyword-date-warning"
                    />
                  ) : undefined
                }
              />
              {canAssign && (
                <IconButton
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-label={t("project_settings.phases.remove_keyword", { name: keyword.name })}
                  icon={<Icon icon={CloseOutline} />}
                  disabled={isRemoving}
                  onClick={() => void handleRemove(keyword.id)}
                />
              )}
            </span>
          );
        })}
      </div>
      {outsideKeywords.length > 0 && (
        <ul className="flex flex-col gap-1" data-testid="phase-keyword-warnings">
          {outsideKeywords.map((keyword) => (
            <li key={keyword.id} className="flex items-center gap-1.5 text-body-xs-regular text-warning-primary">
              <WarningCircleFilled className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{t("project_settings.phases.keyword_outside_dates", { name: keyword.name })}</span>
            </li>
          ))}
        </ul>
      )}
      {canAssign && (
        <div>
          <ModuleSelect
            multiple
            projectId={projectId}
            value={[]}
            onChange={(ids) => void handleAdd(ids)}
            variant="pill-sm"
            placeholder={t("project_settings.phases.add_keywords")}
            disabled={isSaving}
            getOptionDescription={getKeywordPhaseHint}
          />
        </div>
      )}
    </div>
  );
});
