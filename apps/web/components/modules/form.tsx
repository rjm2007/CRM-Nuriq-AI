/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
// plane imports
import {
  DialogActions,
  DialogBody,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { InputField } from "@makeplane/propel/components/input-field";
import { TextAreaField } from "@makeplane/propel/components/text-area-field";
import { ETabIndices } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { DateRangeSelect } from "@plane/blocks/property-select";
import { Button } from "@makeplane/propel/components/button";
import { CalendarOutline } from "@makeplane/propel/icons";
import type { IModule } from "@plane/types";
import { getDate, renderFormattedPayloadDate, getTabIndex } from "@plane/utils";
// components
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { ProjectSelect } from "@/components/dropdowns/project/project-select";
import { ModuleStatusSelect } from "@/components/modules";
import { ProjectPhaseSelect } from "@/components/phases/phase-select";
// hooks
import { usePhase } from "@/hooks/store/use-phase";
import { useUserProfile } from "@/hooks/store/user";
import { useUser } from "@/hooks/store/user/user-user";

/** Neuric: the keyword's phase picked in the form (phases are not a module field; saved after the module). */
export type TModuleFormPhase = { phaseId: string | null; changed: boolean };

type Props = {
  handleFormSubmit: (values: Partial<IModule>, dirtyFields: any, phase?: TModuleFormPhase) => Promise<void>;
  handleClose: () => void;
  status: boolean;
  projectId: string;
  setActiveProject: React.Dispatch<React.SetStateAction<string | null>>;
  data?: IModule;
  isMobile?: boolean;
};

const defaultValues: Partial<IModule> = {
  name: "",
  description: "",
  status: "backlog",
  lead_id: null,
  member_ids: [],
};

export const ModuleForm = observer(function ModuleForm(props: Props) {
  const { handleFormSubmit, handleClose, status, projectId, setActiveProject, data, isMobile = false } = props;
  // store hooks
  const { projectsWithCreatePermissions } = useUser();
  const { data: userProfile } = useUserProfile();
  const { getPhaseIdByModuleId } = usePhase();
  const { workspaceSlug } = useParams();
  // Neuric: phase of the keyword (Step 2)
  const initialPhaseId = (data?.id && getPhaseIdByModuleId(data.id)) || null;
  // `undefined` until the user picks, so a phase list that loads after the form opened still shows
  const [pickedPhaseId, setPhaseId] = useState<string | null | undefined>(undefined);
  const phaseId = pickedPhaseId === undefined ? initialPhaseId : pickedPhaseId;
  // form info
  const {
    formState: { errors, isSubmitting, dirtyFields },
    handleSubmit,
    control,
    reset,
  } = useForm<IModule>({
    defaultValues: {
      project_id: projectId,
      name: data?.name || "",
      description: data?.description || "",
      status: data?.status || "backlog",
      lead_id: data?.lead_id || null,
      member_ids: data?.member_ids || [],
    },
  });

  const { getIndex } = getTabIndex(ETabIndices.PROJECT_MODULE, isMobile);

  const { t } = useTranslation();

  const handleCreateUpdateModule = async (formData: Partial<IModule>) => {
    await handleFormSubmit(formData, dirtyFields, { phaseId, changed: phaseId !== initialPhaseId });

    reset({
      ...defaultValues,
    });
  };

  useEffect(() => {
    reset({
      ...defaultValues,
      ...data,
    });
  }, [data, reset]);

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit(handleCreateUpdateModule)}>
      <DialogMain>
        <DialogHeader>
          <div className="flex items-center gap-x-3">
            {!status && (
              <Controller
                control={control}
                name="project_id"
                render={({ field: { value, onChange } }) => (
                  <ProjectSelect
                    value={value}
                    onChange={(val) => {
                      if (!val) return;
                      onChange(val);
                      setActiveProject(val);
                      // phases belong to one project
                      setPhaseId(null);
                    }}
                    multiple={false}
                    variant="pill-sm"
                    filterOption={(id) => !!projectsWithCreatePermissions?.[id]}
                    tabIndex={getIndex("cover_image")}
                  />
                )}
              />
            )}
            <DialogHeading>
              <DialogTitle>
                {status ? t("common.update") : t("common.create")} {t("common.module").toLowerCase()}
              </DialogTitle>
            </DialogHeading>
          </div>
        </DialogHeader>
        <DialogBody tabIndex={0}>
          <div className="space-y-3">
            <div className="space-y-1">
              <Controller
                control={control}
                name="name"
                rules={{
                  required: t("title_is_required"),
                  maxLength: {
                    value: 255,
                    message: t("title_should_be_less_than_255_characters"),
                  },
                }}
                render={({ field: { value, onChange } }) => (
                  <InputField
                    size="xl"
                    orientation="vertical"
                    error={errors?.name?.message}
                    id="name"
                    name="name"
                    type="text"
                    value={value}
                    onChange={onChange}
                    placeholder={t("title")}
                    aria-label={t("title")}
                    tabIndex={getIndex("name")}
                    // oxlint-disable-next-line jsx-a11y/no-autofocus -- the create/edit dialog opens on the title field
                    autoFocus
                  />
                )}
              />
            </div>
            <div>
              <Controller
                name="description"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <TextAreaField
                    size="xl"
                    autoResize
                    maxRows={8}
                    error={errors?.description?.message}
                    id="description"
                    name="description"
                    value={value}
                    onChange={onChange}
                    placeholder={t("description")}
                    aria-label={t("description")}
                    tabIndex={getIndex("description")}
                  />
                )}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Controller
                control={control}
                name="start_date"
                render={({ field: { value: startDateValue, onChange: onChangeStartDate } }) => (
                  <Controller
                    control={control}
                    name="target_date"
                    render={({ field: { value: endDateValue, onChange: onChangeEndDate } }) => (
                      <DateRangeSelect
                        variant="pill-sm"
                        className="max-w-none"
                        value={{
                          from: getDate(startDateValue) ?? null,
                          to: getDate(endDateValue) ?? null,
                        }}
                        onChange={(range) => {
                          onChangeStartDate(range.from ? renderFormattedPayloadDate(range.from) : null);
                          onChangeEndDate(range.to ? renderFormattedPayloadDate(range.to) : null);
                        }}
                        placeholder={`${t("start_date")} - ${t("end_date")}`}
                        icon={<CalendarOutline />}
                        weekStartsOn={userProfile?.start_of_the_week}
                        tabIndex={getIndex("date_range")}
                      />
                    )}
                  />
                )}
              />
              <ModuleStatusSelect control={control} error={errors.status} tabIndex={getIndex("status")} />
              {/* Neuric: phase (Step 2) */}
              {workspaceSlug && projectId && (
                <ProjectPhaseSelect
                  workspaceSlug={workspaceSlug.toString()}
                  projectId={projectId}
                  value={phaseId}
                  onChange={setPhaseId}
                  variant="pill-sm"
                  tabIndex={getIndex("phase")}
                  testId="module-form-phase-select"
                />
              )}
              <Controller
                control={control}
                name="lead_id"
                render={({ field: { value, onChange } }) => (
                  <MemberSelect
                    value={value}
                    onChange={onChange}
                    projectId={projectId}
                    multiple={false}
                    placeholder={t("lead")}
                    variant="pill-sm"
                    tabIndex={getIndex("lead")}
                  />
                )}
              />
              <Controller
                control={control}
                name="member_ids"
                render={({ field: { value, onChange } }) => (
                  <MemberSelect
                    value={value ?? []}
                    onChange={onChange}
                    projectId={projectId}
                    multiple
                    placeholder={t("members")}
                    variant={value?.length ? "avatar-group-sm" : "pill-sm"}
                    tabIndex={getIndex("member_ids")}
                  />
                )}
              />
            </div>
          </div>
        </DialogBody>
      </DialogMain>
      <DialogActions>
        <Button
          variant="secondary"
          size="md"
          stretch="auto"
          onClick={handleClose}
          tabIndex={getIndex("cancel")}
          label={t("cancel")}
        />
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          type="submit"
          loading={isSubmitting}
          tabIndex={getIndex("submit")}
          label={
            status
              ? isSubmitting
                ? t("updating")
                : t("project_module.update_module")
              : isSubmitting
                ? t("creating")
                : t("project_module.create_module")
          }
        />
      </DialogActions>
    </form>
  );
});
