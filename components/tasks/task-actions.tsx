"use client";

import { setStatusAction, setUrgentAction } from "@/app/(app)/aufgaben/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { t } from "@/i18n";
import type { TaskStatus } from "@/lib/generated/prisma/enums";

/** Statusknöpfe für einfache Aufgaben (BRIEFING 6.3). */
export function StatusButtons({ taskId, current, next }: { taskId: string; current: TaskStatus; next: TaskStatus[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {next.map((status) => (
        <ActionForm key={status} action={setStatusAction.bind(null, taskId, status)}>
          <SubmitButton size="sm" variant={status === "ERLEDIGT" ? "default" : "outline"}>
            {current === "ERLEDIGT" && status === "IN_BEARBEITUNG"
              ? t.tasks.statusActions.reopen
              : t.tasks.statusActions[status as keyof typeof t.tasks.statusActions]}
          </SubmitButton>
        </ActionForm>
      ))}
    </div>
  );
}

/** Hochstufen auf Dringend und Entfernen der Markierung, nur CVD (BRIEFING 6.2). */
export function UrgentToggle({ taskId, marked }: { taskId: string; marked: boolean }) {
  return (
    <ActionForm action={setUrgentAction.bind(null, taskId, !marked)}>
      <SubmitButton size="sm" variant={marked ? "outline" : "destructive"}>
        {marked ? t.tasks.unmarkUrgent : t.tasks.markUrgent}
      </SubmitButton>
    </ActionForm>
  );
}
