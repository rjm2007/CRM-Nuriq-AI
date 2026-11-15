/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Neuric: inline create / edit form of a project phase (Step 2). Same shape as the States form.

import { useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { InputField } from "@makeplane/propel/components/input-field";
import { TextAreaField } from "@makeplane/propel/components/text-area-field";
import { CalendarOutline } from "@makeplane/propel/icons";
// plane imports
import { DateRangeSelect } from "@plane/blocks/property-select";
import { PHASE_NAME_MAX_LENGTH } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { getDate, renderFormattedPayloadDate } from "@plane/utils";
// hooks
import { useUserProfile } from "@/hooks/store/user";

export type TPhaseFormValues = {
  name: string;
  description: string;
  start_date: string | null;
  target_date: string | null;
};

type TPhaseForm = {
  initialValues?: Partial<TPhaseFormValues>;
  /** Resolves once saved; a rejected promise keeps the form open (the caller shows the toast). */
  onSubmit: (values: TPhaseFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  submittingLabel: string;
};

export function PhaseForm(props: TPhaseForm) {
  const { initialValues, onSubmit, onCancel, submitLabel, submittingLabel } = props;
  const { t } = useTranslation();
  const { data: userProfile } = useUserProfile();
  const [values, setValues] = useState<TPhaseFormValues>({
    name: initialValues?.name ?? "",
    description: initialValues?.description ?? "",
    start_date: initialValues?.start_date ?? null,
    target_date: initialValues?.target_date ?? null,
  });
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = values.name.trim();
    if (!name) {
      setNameError(t("project_settings.phases.form.name_required"));
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ ...values, name, description: values.description.trim() });
    } catch {
      // the caller already showed the error; keep what the user typed
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="relative rounded-lg border border-subtle bg-layer-2" onSubmit={(e) => void handleSubmit(e)}>
      <div className="space-y-3 p-4">
        <InputField
          size="lg"
          orientation="vertical"
          id="phase-name"
          name="name"
          type="text"
          aria-label={t("project_settings.phases.form.name")}
          placeholder={t("project_settings.phases.form.name")}
          value={values.name}
          onChange={(e) => {
            setValues((prev) => ({ ...prev, name: e.target.value }));
            setNameError(undefined);
          }}
          maxLength={PHASE_NAME_MAX_LENGTH}
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- the inline form opens on the name field, like the States form
          autoFocus
          error={nameError}
        />
        <TextAreaField
          size="lg"
          resize="none"
          autoResize
          maxRows={6}
          id="phase-description"
          name="description"
          aria-label={t("description")}
          placeholder={t("project_settings.phases.form.description_placeholder")}
          value={values.description}
          onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
        />
        <DateRangeSelect
          variant="pill-sm"
          className="max-w-none"
          value={{ from: getDate(values.start_date) ?? null, to: getDate(values.target_date) ?? null }}
          onChange={(range) =>
            setValues((prev) => ({
              ...prev,
              start_date: (range.from && renderFormattedPayloadDate(range.from)) || null,
              target_date: (range.to && renderFormattedPayloadDate(range.to)) || null,
            }))
          }
          placeholder={`${t("start_date")} - ${t("target_date")}`}
          icon={<CalendarOutline />}
          weekStartsOn={userProfile?.start_of_the_week}
        />
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-subtle-1 px-4 py-3">
        <Button
          type="button"
          variant="secondary"
          size="md"
          stretch="auto"
          label={t("cancel")}
          disabled={isSubmitting}
          onClick={onCancel}
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          stretch="auto"
          label={isSubmitting ? submittingLabel : submitLabel}
          disabled={isSubmitting}
          data-testid="phase-form-submit"
        />
      </div>
    </form>
  );
}
