/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: keyword map (Step 2). Fourth Modules layout: keywords as boxes in phase swimlanes, directed
// ModuleRelation edges between them. The canvas itself is `@plane/blocks/graph-canvas` (lazy).

import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import type {
  GraphCanvasEdge,
  GraphCanvasLabels,
  GraphCanvasLane,
  GraphCanvasNode,
  GraphCanvasPositions,
} from "@plane/blocks/graph-canvas";
import { Button } from "@makeplane/propel/components/button";
import { Spinner } from "@plane/blocks/spinner";
import { setToast } from "@plane/blocks/toast";
import { EUserPermissionsLevel, PROJECT_MODULE_RELATIONS_SWR_KEY } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EUserProjectRoles } from "@plane/types";
import type { IModuleRelation } from "@plane/types";
import { generateQueryParams } from "@plane/utils";
// hooks
import { useModule } from "@/hooks/store/use-module";
import { useModuleRelation } from "@/hooks/store/use-phase";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { useProjectPhases } from "@/hooks/use-project-phases";
// local
import { getKeywordMapPositionsKey, readKeywordMapPositions, writeKeywordMapPositions } from "./positions-storage";

const GraphCanvas = lazy(function GraphCanvas() {
  return import("@plane/blocks/graph-canvas").then((mod) => ({ default: mod.GraphCanvas }));
});

const EMPTY_RELATIONS: IModuleRelation[] = [];

type Props = {
  /** Keywords to show (the list view's filtered ids, so filters apply to the map too). */
  moduleIds: string[];
};

export function MapLoader() {
  return (
    <div className="flex size-full items-center justify-center">
      <Spinner />
    </div>
  );
}

export const ModulesMapView = observer(function ModulesMapView({ moduleIds }: Props) {
  // router
  const router = useAppRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { workspaceSlug: routeWorkspaceSlug, projectId: routeProjectId } = useParams();
  const workspaceSlug = routeWorkspaceSlug?.toString();
  const projectId = routeProjectId?.toString();
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { getModuleById } = useModule();
  const { fetchRelations, getProjectRelations, createRelation, updateRelation, deleteRelation } = useModuleRelation();
  const { data: currentUser } = useUser();
  const { allowPermissions } = useUserPermissions();
  const { phases, isLoading: isLoadingPhases } = useProjectPhases(workspaceSlug, projectId);
  // relations
  const {
    error: relationsError,
    isValidating: isRetryingRelations,
    mutate: retryRelations,
  } = useSWR(
    workspaceSlug && projectId ? PROJECT_MODULE_RELATIONS_SWR_KEY(projectId) : null,
    workspaceSlug && projectId ? () => fetchRelations(workspaceSlug, projectId) : null,
    { revalidateIfStale: false, revalidateOnFocus: false, shouldRetryOnError: false }
  );
  // a 403 (e.g. guests when the project hides features from them) means "no relations to show":
  // a read-only map without edges, not an error
  const relationsForbidden = (relationsError as { status?: number } | undefined)?.status === 403;
  const storedRelations = getProjectRelations(projectId);
  const relations = relationsForbidden ? EMPTY_RELATIONS : storedRelations;
  // relation writes are open to admins and members, like the API
  const canEdit =
    !relationsForbidden &&
    allowPermissions([EUserProjectRoles.ADMIN, EUserProjectRoles.MEMBER], EUserPermissionsLevel.PROJECT);

  // positions (per user + project)
  const positionsKey = currentUser?.id && projectId ? getKeywordMapPositionsKey(currentUser.id, projectId) : null;
  const [stored, setStored] = useState<{ key: string | null; positions: GraphCanvasPositions }>(() => ({
    key: positionsKey,
    positions: positionsKey ? readKeywordMapPositions(positionsKey) : {},
  }));
  // user or project changed: load that map's positions (derived state, set during render)
  if (stored.key !== positionsKey)
    setStored({ key: positionsKey, positions: positionsKey ? readKeywordMapPositions(positionsKey) : {} });
  const positions = stored.positions;

  const handlePositionsChange = useCallback(
    (next: GraphCanvasPositions) => {
      setStored({ key: positionsKey, positions: next });
      if (positionsKey) writeKeywordMapPositions(positionsKey, next);
    },
    [positionsKey]
  );

  // derived values: lanes = phases in order; keywords ordered by phase, then by the list order
  const lanes = useMemo<GraphCanvasLane[]>(
    () => (phases ?? []).map((phase) => ({ id: phase.id, title: phase.name })),
    [phases]
  );

  // Store values are read here, in render, so the observer tracks them: phases' `module_ids` and
  // keyword names/progress change in place (same array/object), which memo deps would not see.
  const phasesKey = (phases ?? []).map((phase) => `${phase.id}:${phase.module_ids.join(",")}`).join("|");
  const keywordsKey = moduleIds
    .map((id) => {
      const keyword = getModuleById(id);
      return keyword ? `${id}:${keyword.name}:${keyword.completed_issues ?? 0}:${keyword.total_issues ?? 0}` : id;
    })
    .join("|");
  const relationsKey = (relations ?? [])
    .map((relation) => `${relation.id}:${relation.source_module}:${relation.target_module}:${relation.label}`)
    .join("|");

  const nodes = useMemo<GraphCanvasNode[]>(() => {
    const visible = new Set(moduleIds);
    const placed = new Set<string>();
    const ordered: { id: string; laneId: string | null }[] = [];
    (phases ?? []).forEach((phase) => {
      phase.module_ids.forEach((moduleId) => {
        if (!visible.has(moduleId) || placed.has(moduleId)) return;
        placed.add(moduleId);
        ordered.push({ id: moduleId, laneId: phase.id });
      });
    });
    moduleIds.forEach((moduleId) => {
      if (!placed.has(moduleId)) ordered.push({ id: moduleId, laneId: null });
    });
    return ordered.flatMap(({ id, laneId }) => {
      const keyword = getModuleById(id);
      if (!keyword) return [];
      return [
        {
          id,
          laneId,
          label: keyword.name,
          meta: t("keyword_map.node_meta", {
            completed: keyword.completed_issues ?? 0,
            total: keyword.total_issues ?? 0,
          }),
        },
      ];
    });
    // phasesKey/keywordsKey stand for the in-place store changes (see above)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [phasesKey, keywordsKey, t]);

  const edges = useMemo<GraphCanvasEdge[]>(() => {
    const visible = new Set(nodes.map((node) => node.id));
    return (relations ?? [])
      .filter((relation) => visible.has(relation.source_module) && visible.has(relation.target_module))
      .map((relation) => ({
        id: relation.id,
        source: relation.source_module,
        target: relation.target_module,
        label: relation.label,
      }));
    // relationsKey stands for label edits made in place
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, relationsKey]);

  const labels = useMemo<GraphCanvasLabels>(
    () => ({
      canvas: t("keyword_map.canvas_label"),
      noLane: t("keyword_map.no_phase"),
      addEdgeLabel: t("keyword_map.add_label"),
      editEdgeLabel: t("keyword_map.edit_label"),
      edgeLabelInput: t("keyword_map.label_input"),
      deleteEdge: t("keyword_map.delete_relation"),
      linkTo: t("common.link"),
      laneCount: (count: number) => `${count} ${t("module.label", { count })}`,
      zoomIn: t("keyword_map.zoom_in"),
      zoomOut: t("keyword_map.zoom_out"),
      fitView: t("keyword_map.fit_view"),
      controls: t("keyword_map.controls"),
    }),
    [t]
  );

  // handlers
  const handleNodeClick = useCallback(
    (moduleId: string) => {
      // same toggle as the list item's peek button
      const query = generateQueryParams(searchParams, ["peekModule"]);
      if (searchParams.get("peekModule") === moduleId) router.push(`${pathname}?${query}`);
      else router.push(`${pathname}?${query && `${query}&`}peekModule=${moduleId}`);
    },
    [pathname, router, searchParams]
  );

  const handleConnect = useCallback(
    async (source: string, target: string) => {
      if (!workspaceSlug || !projectId) return;
      try {
        await createRelation(workspaceSlug, projectId, { source_module: source, target_module: target, label: "" });
      } catch {
        setToast({ type: "error", title: t("toast.error"), message: t("keyword_map.errors.create") });
      }
    },
    [createRelation, projectId, t, workspaceSlug]
  );

  const handleEdgeLabelChange = useCallback(
    async (relationId: string, label: string) => {
      if (!workspaceSlug || !projectId) return;
      try {
        await updateRelation(workspaceSlug, projectId, relationId, { label });
      } catch {
        setToast({ type: "error", title: t("toast.error"), message: t("keyword_map.errors.update") });
      }
    },
    [projectId, t, updateRelation, workspaceSlug]
  );

  const handleEdgeDelete = useCallback(
    async (relationId: string) => {
      if (!workspaceSlug || !projectId) return;
      try {
        await deleteRelation(workspaceSlug, projectId, relationId);
      } catch {
        setToast({ type: "error", title: t("toast.error"), message: t("keyword_map.errors.delete") });
      }
    },
    [deleteRelation, projectId, t, workspaceSlug]
  );

  if (!workspaceSlug || !projectId) return null;

  // relations failed: inline error with a retry (the map without its edges would look complete)
  if (relationsError && !relationsForbidden && !relations)
    return (
      <div className="flex size-full flex-col items-center justify-center gap-3" role="alert">
        <p className="text-body-sm-regular text-secondary">{t("keyword_map.errors.load")}</p>
        <Button
          variant="secondary"
          size="md"
          stretch="auto"
          label={t("common.retry")}
          onClick={() => void retryRelations()}
          loading={isRetryingRelations}
        />
      </div>
    );

  // wait for phases (lanes) and relations (edges) so the canvas doesn't fit and jump twice
  if (!relations || isLoadingPhases) return <MapLoader />;

  return (
    <div className="size-full overflow-hidden">
      <Suspense fallback={<MapLoader />}>
        <GraphCanvas
          nodes={nodes}
          lanes={lanes}
          edges={edges}
          labels={labels}
          positions={positions}
          onPositionsChange={handlePositionsChange}
          onNodeClick={handleNodeClick}
          onConnect={(source, target) => void handleConnect(source, target)}
          onEdgeLabelChange={(relationId, label) => void handleEdgeLabelChange(relationId, label)}
          onEdgeDelete={(relationId) => void handleEdgeDelete(relationId)}
          readOnly={!canEdit}
        />
      </Suspense>
    </div>
  );
});
