/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { observer } from "mobx-react";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { TextAreaField } from "@makeplane/propel/components/text-area-field";
import { DurationInput } from "@plane/blocks/duration-input";
import { DateSelect } from "@plane/blocks/property-select";
import { EUserPermissions } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TIssueWorkLog, TIssueWorkLogPayload } from "@plane/types";
import { isValidWorkLogDuration } from "@plane/utils";
// components
import { MemberSelect } from "@/components/dropdowns/member/member-select";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useUserProfile } from "@/hooks/store/user";
// local imports
import type { TWorkLogOperations, TWorkLogPermissions } from "./helper";

const NOTE_MAX_LENGTH = 2000;

type Props = {
  workspaceSlug: string;
  /** The work item this modal serves; it opens only for \`workLogModal.issueId === issueId\`. */
  issueId: string;
  projectId: string;
  operations: TWorkLogOperations;
  permissions: TWorkLogPermissions;
};

type FormProps = Props & {
  entry: TIssueWorkLog | undefined;
  onClose: () => void;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * `started_at` for the picked day. Editing keeps the entry's time of day (and the exact value when
 * the day is unchanged); a new entry uses "now" for today and noon local time for another day.
 */
const toStartedAt = (day: Date, entry: TIssueWorkLog | undefined): string => {
  if (entry) {
    const previous = new Date(entry.started_at);
    if (isSameDay(previous, day)) return entry.started_at;
    const next = new Date(previous);
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    return next.toISOString();
  }
  const now = new Date();
  if (isSameDay(now, day)) return now.toISOString();
  const noon = new Date(day);
  noon.setHours(12, 0, 0, 0);
  return noon.toISOString();
};

const WorkLogForm = observer(function WorkLogForm(props: FormProps) {
  const { entry, onClose, operations, permissions, projectId, workspaceSlug } = props;
  const { t } = useTranslation();
  const { data: userProfile } = useUserProfile();
  const {
    project: { getProjectMemberIds, getProjectMemberDetails, fetchProjectMembers },
  } = useMember();
  const ids = useId();
  // states
  const [day, setDay] = useState<Date>(() => (entry ? new Date(entry.started_at) : new Date()));
  const [duration, setDuration] = useState<number | undefined>(entry?.duration_minutes);
  const [note, setNote] = useState(entry?.note ?? "");
  const [userId, setUserId] = useState<string | undefined>(entry?.user ?? permissions.currentUserId);
  const [showRequired, setShowRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // derived values
  const isEdit = !!entry;
  const dateId = `${ids}-date`;
  const memberId = `${ids}-member`;
  // The API accepts only project ADMIN/MEMBER (raw project role, no workspace-admin elevation).
  const projectMemberIds = permissions.isAdmin ? getProjectMemberIds(projectId, false) : [];
  const loggableMemberIds = permissions.isAdmin
    ? (projectMemberIds ?? []).filter((id) => {
        const details = getProjectMemberDetails(id, projectId);
        const role = details?.original_role ?? details?.role;
        return role === EUserPermissions.ADMIN || role === EUserPermissions.MEMBER;
      })
    : [];
  const isProjectRosterMissing = projectMemberIds === null;

  // load the project roster once so the member picker can filter by project role
  useEffect(() => {
    if (!isProjectRosterMissing || !workspaceSlug) return;
    fetchProjectMembers(workspaceSlug, projectId).catch((error: unknown) => {
      console.error("Failed to load project members", error);
    });
  }, [isProjectRosterMissing, workspaceSlug, projectId, fetchProjectMembers]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidWorkLogDuration(duration)) {
      setShowRequired(true);
      return;
    }
    const payload: TIssueWorkLogPayload = {
      started_at: toStartedAt(day, entry),
      duration_minutes: duration,
      note: note.trim(),
    };
    // Only admins may name a member; the API defaults `user` to the caller.
    if (permissions.isAdmin && userId && userId !== (entry?.user ?? permissions.currentUserId)) payload.user = userId;
    setIsSubmitting(true);
    try {
      if (entry) await operations.update(entry.id, payload);
      else await operations.create(payload);
      onClose();
    } catch {
      // the operation already showed a toast; keep the modal open so nothing typed is lost
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex min-h-0 flex-1 flex-col">
      <DialogMain>
        <DialogHeader>
          <DialogHeading>
            <DialogTitle>{isEdit ? t("work_log.edit_entry") : t("work_log.log_time")}</DialogTitle>
          </DialogHeading>
        </DialogHeader>
        <DialogBody render={<div className="flex flex-col gap-4" />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={dateId} className="text-body-xs-medium text-secondary">
                {t("work_log.fields.date")}
              </label>
              <DateSelect
                id={dateId}
                value={day}
                onChange={(value) => value && setDay(value)}
                maxDate={new Date()}
                weekStartsOn={userProfile?.start_of_the_week}
                variant="select-lg"
                testId="work-log-date-select"
              />
            </div>
            <DurationInput
              id={`${ids}-duration`}
              label={t("work_log.fields.duration")}
              placeholder={t("work_log.fields.duration_placeholder")}
              hint={t("work_log.fields.duration_hint")}
              invalidMessage={t("work_log.fields.duration_invalid")}
              error={showRequired && duration === undefined ? t("work_log.fields.duration_required") : undefined}
              value={duration}
              onChange={setDuration}
              required
            />
          </div>
          {permissions.isAdmin && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={memberId} className="text-body-xs-medium text-secondary">
                {t("work_log.fields.member")}
              </label>
              <MemberSelect
                id={memberId}
                projectId={projectId}
                memberIds={loggableMemberIds}
                // the trigger's accessible name is "<heading>, <selected member>"
                tooltip={{ heading: t("work_log.fields.member") }}
                value={userId}
                onChange={(id) => setUserId(id)}
                variant="select-lg"
                testId="work-log-member-select"
              />
            </div>
          )}
          <TextAreaField
            size="lg"
            autoResize
            maxRows={6}
            id={`${ids}-note`}
            label={t("work_log.fields.note")}
            hint={t("common.optional")}
            placeholder={t("work_log.fields.note_placeholder")}
            maxLength={NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </DialogBody>
      </DialogMain>
      <DialogActions>
        <Button
          variant="secondary"
          size="md"
          stretch="auto"
          onClick={onClose}
          disabled={isSubmitting}
          label={t("common.cancel")}
        />
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          type="submit"
          loading={isSubmitting}
          label={isSubmitting ? t("work_log.saving") : isEdit ? t("work_log.save") : t("work_log.log_time")}
        />
      </DialogActions>
    </form>
  );
});

/** "Log time" / "Edit time entry" dialog, opened through `workLog.toggleWorkLogModal`. */
export const IssueWorkLogModal = observer(function IssueWorkLogModal(props: Props) {
  const {
    workLog: { workLogModal, toggleWorkLogModal, getWorkLogById },
  } = useIssueDetail();
  // derived values
  const modal = workLogModal?.issueId === props.issueId ? workLogModal : null;
  const entry = modal?.workLogId ? getWorkLogById(modal.workLogId) : undefined;
  // The entry being edited was deleted (here or elsewhere): close instead of turning into "Log time".
  const isEditedEntryGone = !!modal?.workLogId && !entry;
  const handleClose = () => toggleWorkLogModal(null);

  useEffect(() => {
    if (isEditedEntryGone) toggleWorkLogModal(null);
  }, [isEditedEntryGone, toggleWorkLogModal]);

  return (
    <Dialog
      open={!!modal && !isEditedEntryGone}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="md">
        {modal && !isEditedEntryGone && (
          <WorkLogForm
            key={`${modal.issueId}-${modal.workLogId ?? "new"}`}
            {...props}
            entry={entry}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
});
