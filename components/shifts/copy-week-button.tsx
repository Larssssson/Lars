"use client";

import { copyWeekAction } from "@/app/(app)/dienstplan/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { t } from "@/i18n";

export function CopyWeekButton({ fromDay, toDay }: { fromDay: string; toDay: string }) {
  return (
    <ActionForm action={copyWeekAction.bind(null, fromDay, toDay)}>
      <SubmitButton size="sm">{t.shifts.copyToNext}</SubmitButton>
    </ActionForm>
  );
}
