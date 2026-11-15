/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: project settings fields for `target_date` and `prd_page` (used by ./form.tsx).

import { observer } from "mobx-react";
import Link from "next/link";
import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import useSWR from "swr";
import { FieldLabel } from "@makeplane/propel/elements/field";
import { CalendarOutline, NewTabOutline } from "@makeplane/propel/icons";
import { DateSelect, PageSelect } from "@plane/blocks/property-select";
import type { PageOption } from "@plane/blocks/property-select";
import { useTranslation } from "@plane/i18n";
import { EPageAccess } from "@plane/types";
import type { IProject } from "@plane/types";
import { getDate, getPageName, isProjectTargetDateOverdue, orderPages, renderFormattedPayloadDate } from "@plane/utils";
// hooks
import { EPageStoreType, usePageStore } from "@/hooks/store/use-page-store";
import { useUserProfile } from "@/hooks/store/user";

const TARGET_DATE_ID = "project-target-date";
const TARGET_DATE_WARNING_ID = "project-target-date-warning";
const PRD_PAGE_ID = "project-prd-page";

type TargetDateProps = {
  control: Control<IProject>;
  disabled: boolean;
};

export const ProjectTargetDateField = observer(function ProjectTargetDateField(props: TargetDateProps) {
  const { control, disabled } = props;
  const { t } = useTranslation();
  const { data: userProfile } = useUserProfile();

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel size="lg" inset={false} htmlFor={TARGET_DATE_ID}>
        {t("target_date")}
      </FieldLabel>
      <Controller
        name="target_date"
        control={control}
        render={({ field: { value, onChange } }) => {
          // Same rule as the project card (due today counts); the settings form only edits active projects.
          const isOverdue = isProjectTargetDateOverdue(value, false);
          return (
            <>
              <DateSelect
                id={TARGET_DATE_ID}
                aria-describedby={isOverdue ? TARGET_DATE_WARNING_ID : undefined}
                value={getDate(value) ?? null}
                onChange={(date) => onChange(date ? (renderFormattedPayloadDate(date) ?? null) : null)}
                placeholder={t("target_date")}
                icon={<CalendarOutline />}
                weekStartsOn={userProfile?.start_of_the_week}
                clearable
                clearLabel={t("common.clear")}
                variant="select-lg"
                className="font-medium"
                disabled={disabled}
                testId="project-target-date"
              />
              {isOverdue && (
                <p id={TARGET_DATE_WARNING_ID} className="text-body-xs-regular text-warning-primary">
                  {t("project.target_date_past_warning")}
                </p>
              )}
            </>
          );
        }}
      />
    </div>
  );
});

type PrdPageProps = {
  control: Control<IProject>;
  workspaceSlug: string;
  projectId: string;
  /** The PRD page id saved on the project; "Open PRD" only links to a saved page. */
  savedPrdPageId: string | null | undefined;
  disabled: boolean;
};

export const ProjectPrdPageField = observer(function ProjectPrdPageField(props: PrdPageProps) {
  const { control, workspaceSlug, projectId, savedPrdPageId, disabled } = props;
  const { t } = useTranslation();
  const { data: pagesMap, loader, fetchPagesList } = usePageStore(EPageStoreType.PROJECT);

  // Same SWR key as the project pages layout, so the request is shared and deduplicated.
  const { isLoading } = useSWR(workspaceSlug && projectId ? `PROJECT_PAGES_${projectId}` : null, () =>
    fetchPagesList(workspaceSlug, projectId)
  );
  const isPagesLoading = isLoading || loader === "init-loader";

  // Backend rule: the PRD must be a public, non-archived page linked to this project.
  // Computed in render (not memoised) so the observer tracks page access/archive changes.
  const eligiblePages = Object.values(pagesMap ?? {}).filter(
    (page) =>
      !!page.id && !!page.project_ids?.includes(projectId) && page.access === EPageAccess.PUBLIC && !page.archived_at
  );
  const options: PageOption[] = orderPages(eligiblePages, "name", "asc").flatMap((page) =>
    page.id ? [{ id: page.id, name: getPageName(page.name) }] : []
  );

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel size="lg" inset={false} htmlFor={PRD_PAGE_ID}>
        {t("project.prd_page")}
      </FieldLabel>
      <Controller
        name="prd_page"
        control={control}
        render={({ field: { value, onChange } }) => {
          // Only flag a missing page once the page list has loaded.
          const isMissing = !isPagesLoading && !!value && !options.some((page) => page.id === value);
          return (
            <>
              <PageSelect
                id={PRD_PAGE_ID}
                options={options}
                value={value ?? null}
                onChange={(pageId) => onChange(pageId ?? null)}
                placeholder={t("project.prd_page_placeholder")}
                searchPlaceholder={t("project.prd_page_search_placeholder")}
                emptyMessage={t("project.prd_page_empty")}
                missingLabel={isMissing ? t("project.prd_page_missing_short") : undefined}
                clearable={!!value}
                clearLabel={t("project.prd_page_none")}
                variant="select-lg"
                className="font-medium"
                contentSizing="anchor"
                disabled={disabled || isPagesLoading}
                testId="project-prd-page"
              />
              {isMissing && (
                <p role="alert" className="text-body-xs-regular text-danger-primary">
                  {t("project.prd_page_missing")}
                </p>
              )}
              {value && !isMissing && !isPagesLoading && value === savedPrdPageId && (
                <Link
                  href={`/${workspaceSlug}/projects/${projectId}/pages/${value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-fit items-center gap-1 text-body-xs-medium text-accent-primary hover:underline"
                >
                  <NewTabOutline className="size-3.5" />
                  {t("project.open_prd")}
                </Link>
              )}
            </>
          );
        }}
      />
    </div>
  );
});
