"use client";

import { saveVersionAction } from "@/app/(app)/aufgaben/[id]/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { t } from "@/i18n";

export function SaveVersionButton({ taskId }: { taskId: string }) {
  return (
    <ActionForm action={saveVersionAction.bind(null, taskId)}>
      <SubmitButton size="sm" variant="outline">{t.documents.info.saveVersion}</SubmitButton>
    </ActionForm>
  );
}
