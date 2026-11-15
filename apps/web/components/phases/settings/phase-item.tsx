/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: one phase row on the phases settings page (Step 2). Drag-and-drop copied from project-states/state-item.tsx.

import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachClosestEdge, extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { observer } from "mobx-react";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@makeplane/propel/components/menu";
import {
  ArrowDownOutline,
  ArrowUpOutline,
  DeleteOutline,
  DragDropOutline,
  EditOutline,
  MilestoneOutline,
  MoreHorizontalOutline,
} from "@makeplane/propel/icons";
// plane imports
import { DropIndicator } from "@plane/blocks/common";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { useTranslation } from "@plane/i18n";
import type { IModule, IPhase } from "@plane/types";
import { cn, getPhaseKeywordSpan } from "@plane/utils";
// hooks
import { useModule } from "@/hooks/store/use-module";
// local imports
import { formatPhaseDateRange } from "./helper";
import { PhaseForm } from "./phase-form";
import type { TPhaseFormValues } from "./phase-form";
import { PhaseKeywords } from "./phase-keywords";

type TPhaseDragData = { type: "phase"; id: string };

type TPhaseItem = {
  workspaceSlug: string;
  projectId: string;
  phase: IPhase;
  /** Project admins: edit, delete, reorder. */
  isEditable: boolean;
  /** Project admins and members: add / remove keywords. */
  canAssign: boolean;
  /** More than one phase, so dragging means something. */
  isDraggable: boolean;
  onUpdate: (phaseId: string, values: TPhaseFormValues) => Promise<void>;
  onDelete: (phaseId: string) => Promise<void>;
  /** Called when another phase is dropped on this one's `edge`. */
  onDrop: (sourceId: string, targetId: string, edge: "top" | "bottom" | null) => void;
  /** Not the first / last phase, so "Move up" / "Move down" are offered. */
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Keyboard / menu alternative to dragging: swaps with the phase above or below (same drop logic). */
  onMove: (phaseId: string, direction: "up" | "down") => void;
};

export const PhaseItem = observer(function PhaseItem(props: TPhaseItem) {
  const {
    workspaceSlug,
    projectId,
    phase,
    isEditable,
    canAssign,
    isDraggable,
    onUpdate,
    onDelete,
    onDrop,
    canMoveUp,
    canMoveDown,
    onMove,
  } = props;
  const { t } = useTranslation();
  const { getModuleById } = useModule();
  // refs
  const elementRef = useRef<HTMLDivElement | null>(null);
  // states
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<"top" | "bottom" | null>(null);
  // derived values
  const canDrag = isEditable && isDraggable && !isEditing;
  const keywords = (phase.module_ids ?? [])
    .map((moduleId) => getModuleById(moduleId))
    .filter((module): module is IModule => !!module);
  const span = getPhaseKeywordSpan(keywords);
  const phaseDates = formatPhaseDateRange(phase.start_date, phase.target_date);
  const spanDates = formatPhaseDateRange(span.start_date, span.target_date);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const data: TPhaseDragData = { type: "phase", id: phase.id };
    const isPhaseData = (value: Record<string | symbol, unknown>) => value.type === "phase";
    return combine(
      draggable({
        element,
        getInitialData: () => data,
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
        canDrag: () => canDrag,
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => isEditable && isPhaseData(source.data) && source.data.id !== phase.id,
        getData: ({ input, element: target }) =>
          attachClosestEdge(data, { input, element: target, allowedEdges: ["top", "bottom"] }),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data) as "top" | "bottom" | null),
        onDragLeave: () => setClosestEdge(null),
        onDrop: ({ self, source }) => {
          setClosestEdge(null);
          const edge = extractClosestEdge(self.data) as "top" | "bottom" | null;
          if (typeof source.data.id === "string") onDrop(source.data.id, phase.id, edge);
        },
      })
    );
  }, [phase.id, canDrag, isEditable, onDrop]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(phase.id);
      setIsDeleteOpen(false);
    } catch {
      // the caller shows the toast; keep the dialog open
    } finally {
      setIsDeleting(false);
    }
  };

  if (isEditing)
    return (
      <PhaseForm
        initialValues={phase}
        onSubmit={async (values) => {
          await onUpdate(phase.id, values);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
        submitLabel={t("project_settings.phases.form.update")}
        submittingLabel={t("updating")}
      />
    );

  return (
    <div>
      <ConfirmDialog
        handleClose={() => setIsDeleteOpen(false)}
        handleSubmit={handleDelete}
        isSubmitting={isDeleting}
        isOpen={isDeleteOpen}
        title={t("project_settings.phases.delete.title")}
        content={t("project_settings.phases.delete.content", { name: phase.name })}
      />
      <DropIndicator isVisible={closestEdge === "top"} />
      <div
        ref={elementRef}
        className={cn(
          "group relative flex flex-col gap-3 rounded-lg border border-subtle bg-layer-2 px-3.5 py-3 transition-opacity",
          isDragging ? "opacity-50" : "opacity-100",
          canDrag ? "cursor-grab" : "cursor-auto"
        )}
        data-testid="phase-item"
      >
        <div className="flex w-full items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {canDrag && (
              <div className="absolute top-4 -left-1.5 hidden items-center justify-center rounded-sm border border-subtle bg-layer-2 py-0.5 text-secondary transition-colors group-hover:flex hover:bg-layer-2-hover hover:text-primary">
                <DragDropOutline className="size-3" />
              </div>
            )}
            <MilestoneOutline className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
            <div className="min-w-0">
              <h6 className="text-body-sm-medium wrap-break-word text-primary">{phase.name}</h6>
              {phase.description?.trim() && (
                <p className="text-caption-sm-regular wrap-break-word text-secondary">{phase.description}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-caption-sm-regular text-tertiary">
              {phaseDates ?? t("project_settings.phases.no_dates")}
            </span>
            {isEditable && (
              <Menu>
                <MenuTrigger
                  render={
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="xs"
                      aria-label={t("aria_labels.common.more_actions")}
                      icon={<Icon icon={MoreHorizontalOutline} />}
                    />
                  }
                />
                <MenuContent side="bottom" align="end">
                  <MenuItem
                    icon={<Icon icon={EditOutline} />}
                    label={t("common.actions.edit")}
                    onClick={() => setIsEditing(true)}
                  />
                  {canMoveUp && (
                    <MenuItem
                      icon={<Icon icon={ArrowUpOutline} />}
                      label={t("project_settings.phases.move_up")}
                      onClick={() => onMove(phase.id, "up")}
                      data-testid="phase-move-up"
                    />
                  )}
                  {canMoveDown && (
                    <MenuItem
                      icon={<Icon icon={ArrowDownOutline} />}
                      label={t("project_settings.phases.move_down")}
                      onClick={() => onMove(phase.id, "down")}
                      data-testid="phase-move-down"
                    />
                  )}
                  <MenuSeparator />
                  <MenuItem
                    variant="danger"
                    icon={<Icon icon={DeleteOutline} />}
                    label={t("common.actions.delete")}
                    onClick={() => setIsDeleteOpen(true)}
                  />
                </MenuContent>
              </Menu>
            )}
          </div>
        </div>
        <p className="text-caption-sm-regular text-tertiary" data-testid="phase-keyword-span">
          {spanDates
            ? t("project_settings.phases.keyword_span", { dates: spanDates })
            : t("project_settings.phases.keyword_span_empty")}
        </p>
        <PhaseKeywords workspaceSlug={workspaceSlug} projectId={projectId} phase={phase} canAssign={canAssign} />
      </div>
      <DropIndicator isVisible={closestEdge === "bottom"} />
    </div>
  );
});
