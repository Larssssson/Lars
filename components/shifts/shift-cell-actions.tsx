"use client";

import { Plus, X } from "lucide-react";
import { assignShiftAction, removeShiftAction } from "@/app/(app)/dienstplan/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { t } from "@/i18n";

export function RemoveShiftButton({ shiftId, name }: { shiftId: string; name: string }) {
  return (
    <ActionForm action={removeShiftAction.bind(null, shiftId)} className="inline">
      <SubmitButton size="icon" variant="ghost" className="size-6" aria-label={t.shifts.remove(name)}>
        <X aria-hidden />
      </SubmitButton>
    </ActionForm>
  );
}

export function AssignShiftForm({
  shiftTypeId,
  day,
  label,
  users,
}: {
  shiftTypeId: string;
  day: string;
  label: string;
  users: { id: string; name: string }[];
}) {
  const id = `assign-${shiftTypeId}-${day}`;
  return (
    <ActionForm action={assignShiftAction.bind(null, shiftTypeId, day)} className="mt-1 flex items-center gap-1">
      <label htmlFor={id} className="sr-only">{label}</label>
      <select id={id} name="userId" required defaultValue="" className="h-7 w-full min-w-0 rounded border border-input bg-background px-1 text-xs text-muted-foreground">
        <option value="" disabled>{t.shifts.person}</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <SubmitButton size="icon" variant="ghost" className="size-7 shrink-0" aria-label={`${t.shifts.add}: ${label}`}>
        <Plus aria-hidden />
      </SubmitButton>
    </ActionForm>
  );
}
