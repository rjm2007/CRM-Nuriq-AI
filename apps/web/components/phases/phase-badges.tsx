/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: read-only phase labels (Step 2): one badge on a keyword row, all derived phases of a work item.

import { observer } from "mobx-react";
import { Badge } from "@makeplane/propel/components/badge";
import { Icon } from "@makeplane/propel/components/icon";
import { MilestoneOutline } from "@makeplane/propel/icons";
// plane imports
import { useTranslation } from "@plane/i18n";
// components
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
// hooks
import { usePhase } from "@/hooks/store/use-phase";
import { useProjectPhases } from "@/hooks/use-project-phases";

/** One read-only phase label: neutral propel `Badge` with the phase icon and a "Phase: <name>" accessible name. */
export function PhaseBadge(props: { name: string; className?: string; testId?: string }) {
  const { name, className, testId } = props;
  const { t } = useTranslation();
  return (
    <span className={className ?? "flex max-w-full min-w-0"} data-testid={testId}>
      <Badge
        size="sm"
        variant="neutral"
        label={name}
        aria-label={`${t("phase.label")}: ${name}`}
        startIcon={<Icon icon={MilestoneOutline} />}
      />
    </span>
  );
}

/** Phase badge of a keyword (module) list row; renders nothing when the keyword has no phase. */
export const ModulePhaseBadge = observer(function ModulePhaseBadge(props: { moduleId: string }) {
  const { moduleId } = props;
  const { getPhaseIdByModuleId, getPhaseById } = usePhase();
  const phase = getPhaseById(getPhaseIdByModuleId(moduleId));

  if (!phase) return null;
  return <PhaseBadge name={phase.name} className="flex max-w-40 min-w-0 shrink-0" testId="module-phase-badge" />;
});

type TIssuePhaseListProps = {
  workspaceSlug: string;
  projectId: string;
  /** The work item's keywords (`issue.module_ids`); its phases are the phases of these keywords. */
  moduleIds: string[] | null | undefined;
};

/** Read-only phases of a work item, derived from its keywords (one work item may be in several phases). */
export const IssuePhaseList = observer(function IssuePhaseList(props: TIssuePhaseListProps) {
  const { workspaceSlug, projectId, moduleIds } = props;
  const { t } = useTranslation();
  // fetch once per project; also covers work items opened outside the project pages (e.g. My Tasks)
  useProjectPhases(workspaceSlug, projectId);
  const { getPhaseNamesByModuleIds } = usePhase();
  const names = getPhaseNamesByModuleIds(moduleIds);

  return (
    <div className="flex min-h-8 w-full grow flex-wrap items-center gap-1 px-2 py-1" data-testid="issue-phase-list">
      {names.length === 0 ? (
        <span className="text-body-xs-regular text-placeholder">{t("phase.no_phase")}</span>
      ) : (
        names.map((name) => <PhaseBadge key={name} name={name} />)
      )}
    </div>
  );
});

/**
 * Work item sidebar "Phases" row. Hidden when the user may not read the project's phases (guest, API 403), so
 * guests see no row instead of an empty or error one.
 */
export const IssuePhaseRow = observer(function IssuePhaseRow(props: TIssuePhaseListProps) {
  const { workspaceSlug, projectId } = props;
  const { t } = useTranslation();
  useProjectPhases(workspaceSlug, projectId);
  const { isPhasesForbidden } = usePhase();

  if (isPhasesForbidden(projectId)) return null;
  return (
    <SidebarPropertyListItem icon={MilestoneOutline} label={t("phase.label_plural")}>
      <IssuePhaseList {...props} />
    </SidebarPropertyListItem>
  );
});
