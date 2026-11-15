/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: project settings fields for `target_date` and `prd_page` (used by ./form.tsx).

import { useEffect } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { FieldLabel } from "@makeplane/propel/elements/field";
import { CalendarOutline, NewTabOutline } from "@makeplane/propel/icons";
import { DateSelect, PageSelect } from "@plane/blocks/property-select";
import type { PageOption } from "@plane/blocks/property-select";
import { useTranslation } from "@plane/i18n";
import { EPageAccess } from "@plane/types";
import type { IProject } from "@plane/types";
import { getDate, getPageName, renderFormattedPayloadDate } from "@plane/utils";
// hooks
import { EPageStoreType, usePageStore } from "@/hooks/store/use-page-store";
import { useUserProfile } from "@/hooks/store/user";

/** True when a "YYYY-MM-DD" date is before today (local calendar day). */
export const isProjectTargetDatePast = (targetDate: string | null | undefined): boolean => {
  if (!targetDate) return false;
  const today = renderFormattedPayloadDate(new Date());
  return !!today && targetDate < today;
};

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
      <FieldLabel size="lg" inset={false} htmlFor="project-target-date">
        {t("target_date")}
      </FieldLabel>
      <Controller
        name="target_date"
        control={control}
        render={({ field: { value, onChange } }) => (
          <>
            <DateSelect
              value={getDate(value) ?? null}
              onChange={(date) => onChange(date ? (renderFormattedPayloadDate(date) ?? null) : null)}
              placeholder={t("target_date")}
              icon={<CalendarOutline />}
              weekStartsOn={userProfile?.start_of_the_week}
              clearable
              clearLabel={t("common.clear")}
              variant="select-lg"
              disabled={disabled}
              testId="project-target-date"
            />
            {isProjectTargetDatePast(value) && (
              <p className="text-body-xs-regular text-warning-primary">{t("project.target_date_past_warning")}</p>
            )}
          </>
        )}
      />
    </div>
  );
});

type PrdPageProps = {
  control: Control<IProject>;
  workspaceSlug: string;
  projectId: string;
  disabled: boolean;
};

export const ProjectPrdPageField = observer(function ProjectPrdPageField(props: PrdPageProps) {
  const { control, workspaceSlug, projectId, disabled } = props;
  const { t } = useTranslation();
  const { data: pagesMap, fetchPagesList } = usePageStore(EPageStoreType.PROJECT);

  // Load the project's pages once; the page store merges them into its map.
  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    fetchPagesList(workspaceSlug, projectId).catch((error: unknown) => {
      console.error("Failed to fetch project pages for the PRD picker:", error);
    });
  }, [fetchPagesList, workspaceSlug, projectId]);

  // Backend rule: the PRD must be a public, non-archived page linked to this project.
  // Computed in render (not memoised) so the observer tracks page access/archive changes.
  const options: PageOption[] = Object.values(pagesMap ?? {}).flatMap((page) =>
    page.id && page.project_ids?.includes(projectId) && page.access === EPageAccess.PUBLIC && !page.archived_at
      ? [{ id: page.id, name: getPageName(page.name) }]
      : []
  );

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel size="lg" inset={false} htmlFor="project-prd-page">
        {t("project.prd_page")}
      </FieldLabel>
      <Controller
        name="prd_page"
        control={control}
        render={({ field: { value, onChange } }) => {
          const isMissing = !!value && !options.some((page) => page.id === value);
          return (
            <>
              <PageSelect
                options={options}
                value={value ?? null}
                // Re-picking the current page clears it.
                onChange={(pageId) => onChange(!pageId || pageId === value ? null : pageId)}
                placeholder={t("project.prd_page_placeholder")}
                variant="select-lg"
                disabled={disabled}
                testId="project-prd-page"
              />
              {isMissing && <p className="text-body-xs-regular text-danger-primary">{t("project.prd_page_missing")}</p>}
              {value && !isMissing && (
                <Link
                  href={`/${workspaceSlug}/projects/${projectId}/pages/${value}`}
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
