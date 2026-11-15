/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { observer } from "mobx-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
// plane imports
import { ROLE, EUserPermissions } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { AddOutline, ChevronDownOutline, CloseOutline } from "@makeplane/propel/icons";
import { Select } from "@plane/blocks/select";
// components
import { MemberSelect } from "@/components/dropdowns/member/member-select";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useUserPermissions } from "@/hooks/store/user";

export type TProjectMemberInviteRow = {
  role: EUserPermissions;
  member_id: string;
};

export type TProjectMemberInviteFormValues = {
  members: TProjectMemberInviteRow[];
};

type TRoleOption = {
  key: EUserPermissions;
  label: string;
};

type TUseProjectMemberInviteFormArgs = {
  workspaceSlug: string;
  projectId: string;
  /** Role of an empty row, before a member is picked. Picking a member switches it to their workspace role. */
  defaultRole?: EUserPermissions;
  /** Hide workspace guests from the member picker. */
  excludeGuests?: boolean;
  /** Ids that are already in the project but may not be in the member store yet (e.g. creator and lead). */
  excludeMemberIds?: (string | null | undefined)[];
};

/**
 * Form state for adding workspace members to a project (member + role rows).
 * Shared by `SendProjectInvitationModal` (project settings) and the members step of `CreateProjectModal`.
 */
export function useProjectMemberInviteForm(args: TUseProjectMemberInviteFormArgs) {
  const {
    workspaceSlug,
    projectId,
    defaultRole = EUserPermissions.MEMBER,
    excludeGuests = false,
    excludeMemberIds,
  } = args;
  // store hooks
  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const {
    project: { getProjectMemberDetails, bulkAddMembersToProject },
    workspace: { workspaceMemberIds, getWorkspaceMemberDetails },
  } = useMember();
  // form info
  const getEmptyRow = useCallback((): TProjectMemberInviteRow => ({ role: defaultRole, member_id: "" }), [defaultRole]);
  const methods = useForm<TProjectMemberInviteFormValues>({ defaultValues: { members: [getEmptyRow()] } });
  const fieldArray = useFieldArray({ control: methods.control, name: "members" });
  // derived values
  const currentProjectRole = getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId);
  const excludedIds = new Set(excludeMemberIds?.filter((id): id is string => !!id));
  const uninvitedPeople =
    workspaceMemberIds?.filter((userId) => {
      const workspaceMember = getWorkspaceMemberDetails(userId);
      if (!workspaceMember?.member) return false;
      if (excludedIds.has(userId)) return false;
      if (excludeGuests && workspaceMember.role === EUserPermissions.GUEST) return false;
      const projectMemberDetails = getProjectMemberDetails(userId, projectId);
      const isInvited = projectMemberDetails?.member.id && projectMemberDetails?.original_role;
      return !isInvited;
    }) ?? [];

  const checkCurrentOptionWorkspaceRole = (value: string) => {
    const currentMemberWorkspaceRole = getWorkspaceMemberDetails(value)?.role;
    if (!value || !currentMemberWorkspaceRole) return ROLE;

    const isGuestOROwner = [EUserPermissions.ADMIN, EUserPermissions.GUEST].includes(
      currentMemberWorkspaceRole as EUserPermissions
    );

    return Object.fromEntries(
      Object.entries(ROLE).filter(([key]) => !isGuestOROwner || [currentMemberWorkspaceRole].includes(parseInt(key)))
    );
  };

  const getRoleOptions = (memberId: string): TRoleOption[] =>
    Object.entries(checkCurrentOptionWorkspaceRole(memberId))
      .filter(([key]) => parseInt(key) <= (currentProjectRole ?? EUserPermissions.GUEST))
      .map(([key, label]) => ({ key: parseInt(key) as EUserPermissions, label }));

  const handleMemberChange = (index: number, memberId: string, onChange: (val: string) => void) => {
    onChange(memberId);
    // Update the role to the workspace role when member ID changes
    const workspaceMemberDetails = getWorkspaceMemberDetails(memberId);
    const workspaceRole = workspaceMemberDetails?.role ?? EUserPermissions.GUEST;
    const newValue = ROLE[workspaceRole].toUpperCase();
    methods.setValue(`members.${index}.role`, EUserPermissions[newValue as keyof typeof EUserPermissions]);
  };

  const addRow = () => fieldArray.append(getEmptyRow());

  const resetForm = () => methods.reset({ members: [getEmptyRow()] });

  const addMembers = (formData: TProjectMemberInviteFormValues) =>
    bulkAddMembersToProject(workspaceSlug, projectId, { ...formData });

  return {
    methods,
    fieldArray,
    uninvitedPeople,
    getRoleOptions,
    handleMemberChange,
    addRow,
    resetForm,
    addMembers,
  };
}

export type TProjectMemberInviteForm = ReturnType<typeof useProjectMemberInviteForm>;

type TFieldsProps = {
  form: TProjectMemberInviteForm;
};

/** Member + role rows of the project member invite form. Render inside the `<form>` that owns `form.methods`. */
export const ProjectMemberInviteFields = observer(function ProjectMemberInviteFields(props: TFieldsProps) {
  const { form } = props;
  const { t } = useTranslation();
  const {
    methods: {
      control,
      watch,
      formState: { errors },
    },
    fieldArray: { fields, remove },
    uninvitedPeople,
    getRoleOptions,
    handleMemberChange,
  } = form;
  const selectedMemberIds = watch("members")?.map((member) => member.member_id) ?? [];

  return (
    <div className="space-y-4">
      {fields.map((field, index) => (
        <div key={field.id} className="group mb-1 flex w-full items-start justify-between gap-x-4 text-body-xs-regular">
          <div className="flex w-full grow flex-col gap-1">
            <Controller
              control={control}
              name={`members.${index}.member_id`}
              rules={{ required: t("project.members_step.member_required") }}
              render={({ field: { value, onChange } }) => (
                <MemberSelect
                  testId={`project-member-invite-member-${index}`}
                  value={value || null}
                  onChange={(val: string) => handleMemberChange(index, val, onChange)}
                  variant="select-lg"
                  memberIds={uninvitedPeople}
                  // members already picked in other rows
                  excludeIds={selectedMemberIds.filter((id, rowIndex) => !!id && rowIndex !== index)}
                  placeholder={t("project_settings.members.invite_members.select_co_worker")}
                />
              )}
            />
            {errors.members?.[index]?.member_id && (
              <span className="px-1 text-body-xs-regular text-danger-primary">
                {errors.members[index]?.member_id?.message}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <Controller
                name={`members.${index}.role`}
                control={control}
                rules={{ required: t("project.members_step.role_required") }}
                render={({ field: { value, onChange } }) => {
                  const roleOptions = getRoleOptions(watch(`members.${index}.member_id`));
                  return (
                    <div className="w-32">
                      <Select<TRoleOption>
                        getValues={() => roleOptions}
                        value={roleOptions.find((role) => role.key === value) ?? null}
                        onChange={(key) => onChange(parseInt(key))}
                        getOptionValue={(role) => String(role.key)}
                        getOptionLabel={(role) => role.label}
                        placeholder={t("project.members_step.select_role")}
                        showSearch={false}
                        pinSelected={false}
                      >
                        <Select.Trigger<TRoleOption>
                          variant="pill-md"
                          appendIcon={<ChevronDownOutline />}
                          tooltip={{ emptyContent: t("project.members_step.select_role") }}
                        >
                          <span className="min-w-0 grow truncate text-left capitalize">
                            {value ? ROLE[value] : t("project.members_step.select_role")}
                          </span>
                        </Select.Trigger>
                      </Select>
                    </div>
                  );
                }}
              />
              {errors.members?.[index]?.role && (
                <span className="px-1 text-body-xs-regular text-danger-primary">
                  {errors.members[index]?.role?.message}
                </span>
              )}
            </div>

            {fields.length > 1 && (
              <div className="flex-item flex w-6">
                <button
                  type="button"
                  aria-label={t("remove")}
                  className="place-items-center self-center rounded-sm"
                  onClick={() => remove(index)}
                >
                  <CloseOutline className="h-4 w-4 text-secondary" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

type TAddMoreProps = {
  form: TProjectMemberInviteForm;
};

/** "Add more" link for the action row; appends an empty member row. */
export function ProjectMemberInviteAddMoreButton(props: TAddMoreProps) {
  const { form } = props;
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="flex items-center gap-2 bg-transparent py-2 pr-3 text-body-xs-medium text-accent-primary outline-accent-strong"
      onClick={form.addRow}
    >
      <AddOutline className="h-4 w-4" />
      {t("common.add_more")}
    </button>
  );
}
