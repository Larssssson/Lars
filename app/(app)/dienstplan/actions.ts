"use server";

import { revalidatePath } from "next/cache";
import { t } from "@/i18n";
import { assignShift, copyWeek, removeShift } from "@/lib/domain/shifts";
import { runAction, str, type ActionState } from "@/lib/server/action";
import { serverDeps } from "@/lib/server/deps";
import { requireUser } from "@/lib/session";

export async function assignShiftAction(shiftTypeId: string, day: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await assignShift(serverDeps(), await requireUser(), { shiftTypeId, day, userId: str(form, "userId") ?? "" });
  });
  revalidatePath("/", "layout");
  return result;
}

export async function removeShiftAction(shiftId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await removeShift(serverDeps(), await requireUser(), shiftId);
  });
  revalidatePath("/", "layout");
  return result;
}

export async function copyWeekAction(fromDay: string, toDay: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    const created = await copyWeek(serverDeps(), await requireUser(), fromDay, toDay);
    return t.shifts.copied(created);
  });
  revalidatePath("/", "layout");
  return result;
}
