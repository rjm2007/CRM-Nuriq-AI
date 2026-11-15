/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { EUserPermissions } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
// local imports
import type { TProjectMemberInviteFormValues } from "./member-invite-form";
import {
  ProjectMemberInviteAddMoreButton,
  ProjectMemberInviteFields,
  useProjectMemberInviteForm,
} from "./member-invite-form";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  projectId: string;
  workspaceSlug: string;
};

export const SendProjectInvitationModal = observer(function SendProjectInvitationModal(props: Props) {
  const { isOpen, onClose, onSuccess, projectId, workspaceSlug } = props;
  // plane hooks
  const { t } = useTranslation();
  // form info (shared with the members step of the create-project modal)
  const inviteForm = useProjectMemberInviteForm({ workspaceSlug, projectId, defaultRole: EUserPermissions.GUEST });
  const {
    methods: {
      formState: { isSubmitting },
      handleSubmit,
    },
    fieldArray: { fields },
    resetForm,
    addMembers,
  } = inviteForm;

  const onSubmit = async (formData: TProjectMemberInviteFormValues) => {
    if (!workspaceSlug || !projectId || isSubmitting) return;

    try {
      await addMembers(formData);
      if (onSuccess) onSuccess();
      onClose();
      setToast({
        title: "Success!",
        type: "success",
        message: "Members added successfully.",
      });
    } catch (error) {
      console.error(error);
    } finally {
      resetForm();
    }
  };

  const handleClose = () => {
    onClose();

    const timeout = setTimeout(() => {
      resetForm();
      clearTimeout(timeout);
    }, 500);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>{t("project_settings.members.invite_members.title")}</DialogTitle>
                <DialogDescription>{t("project_settings.members.invite_members.sub_heading")}</DialogDescription>
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
                <Button variant="secondary" size="md" stretch="auto" label={t("cancel")} onClick={handleClose} />
                <Button
                  variant="primary"
                  size="md"
                  stretch="auto"
                  type="submit"
                  label={
                    isSubmitting
                      ? `${fields && fields.length > 1 ? `${t("add_members")}...` : `${t("add_member")}...`}`
                      : `${fields && fields.length > 1 ? t("add_members") : t("add_member")}`
                  }
                  loading={isSubmitting}
                />
              </div>
            </div>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
});
