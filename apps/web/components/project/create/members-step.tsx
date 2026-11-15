/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import {
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { setToast } from "@plane/blocks/toast";
// components
import type { TProjectMemberInviteFormValues } from "@/components/project/member-invite-form";
import {
  ProjectMemberInviteAddMoreButton,
  ProjectMemberInviteFields,
  useProjectMemberInviteForm,
} from "@/components/project/member-invite-form";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUser } from "@/hooks/store/user";

type Props = {
  workspaceSlug: string;
  projectId: string;
  /** Goes to the next step; called after members are added or when the step is skipped. */
  onNext: () => void;
};

/**
 * Neuric: optional "Members" step of the create-project modal. Workspace members only (no guests);
 * a row's role starts as Member and follows the picked member's workspace role (the API requires
 * workspace admins to be project admins).
 */
export const ProjectCreateMembersStep = observer(function ProjectCreateMembersStep(props: Props) {
  const { workspaceSlug, projectId, onNext } = props;
  const { t } = useTranslation();
  // store hooks
  const { data: currentUser } = useUser();
  const { getProjectById } = useProject();
  const {
    project: { fetchProjectMembers },
  } = useMember();
  const projectLead = getProjectById(projectId)?.project_lead;
  const projectLeadId = typeof projectLead === "string" ? projectLead : projectLead?.id;
  // the API adds the creator and the lead on create; load them so they are not offered again
  useSWR(`PROJECT_CREATE_MEMBERS_${projectId}`, () => fetchProjectMembers(workspaceSlug, projectId), {
    revalidateIfStale: false,
    revalidateOnFocus: false,
  });
  // form info
  const inviteForm = useProjectMemberInviteForm({
    workspaceSlug,
    projectId,
    excludeGuests: true,
    excludeMemberIds: [currentUser?.id, projectLeadId],
  });
  const {
    methods: {
      formState: { isSubmitting },
      handleSubmit,
    },
    fieldArray: { fields },
    addMembers,
  } = inviteForm;

  const onSubmit = async (formData: TProjectMemberInviteFormValues) => {
    if (isSubmitting) return;
    try {
      await addMembers(formData);
      setToast({
        type: "success",
        title: t("success"),
        message: t("project.members_step.members_added"),
      });
      onNext();
    } catch (error) {
      console.error(error);
      setToast({
        type: "error",
        title: t("toast.error"),
        message: t("something_went_wrong"),
      });
    }
  };

  const submitLabel = fields.length > 1 ? t("add_members") : t("add_member");

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex min-h-0 flex-1 flex-col"
      data-testid="create-project-members-step"
    >
      <DialogMain>
        <DialogHeader>
          <DialogHeading>
            <DialogTitle>{t("add_members")}</DialogTitle>
            <DialogDescription>{t("project.members_step.description")}</DialogDescription>
          </DialogHeading>
        </DialogHeader>
        <DialogBody>
          <ProjectMemberInviteFields form={inviteForm} />
        </DialogBody>
      </DialogMain>
      <DialogActions>
        <div className="flex w-full items-center justify-between gap-2">
          <ProjectMemberInviteAddMoreButton form={inviteForm} />
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              stretch="auto"
              label={t("project.members_step.skip")}
              onClick={onNext}
              disabled={isSubmitting}
            />
            <Button
              variant="primary"
              size="md"
              stretch="auto"
              type="submit"
              label={isSubmitting ? `${submitLabel}...` : submitLabel}
              loading={isSubmitting}
            />
          </div>
        </div>
      </DialogActions>
    </form>
  );
});
