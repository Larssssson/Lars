"use client";

import { markAllReadAction, markReadAction } from "@/app/(app)/benachrichtigungen/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { t } from "@/i18n";

export function MarkReadButton({ id }: { id: string }) {
  return (
    <ActionForm action={markReadAction.bind(null, id)}>
      <SubmitButton size="sm" variant="ghost">{t.notifications.markRead}</SubmitButton>
    </ActionForm>
  );
}

export function MarkAllReadButton() {
  return (
    <ActionForm action={markAllReadAction}>
      <SubmitButton size="sm" variant="outline">{t.notifications.markAllRead}</SubmitButton>
    </ActionForm>
  );
}
