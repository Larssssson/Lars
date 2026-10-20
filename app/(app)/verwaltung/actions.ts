"use server";

import { revalidatePath } from "next/cache";
import { t } from "@/i18n";
import { createUser, grantPermission, revokePermission, setUserActive, setUserRole } from "@/lib/domain/permissions/admin";
import { createShiftType, updateShiftType } from "@/lib/domain/shifts";
import type { Permission } from "@/lib/generated/prisma/enums";
import { bool, runAction, str, type ActionState } from "@/lib/server/action";
import { serverDeps } from "@/lib/server/deps";
import { requireUser } from "@/lib/session";

export async function createUserAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await createUser(serverDeps(), await requireUser(), {
      name: str(form, "name") ?? "",
      email: str(form, "email") ?? "",
      role: str(form, "role") === "CVD" ? "CVD" : "REDAKTEUR",
      isAdmin: bool(form, "isAdmin"),
    });
    return t.common.saved;
  });
  revalidatePath("/verwaltung", "layout");
  return result;
}

export async function setUserRoleAction(userId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await setUserRole(serverDeps(), await requireUser(), userId, str(form, "role") === "CVD" ? "CVD" : "REDAKTEUR", bool(form, "isAdmin"));
    return t.common.saved;
  });
  revalidatePath("/", "layout");
  return result;
}

export async function setUserActiveAction(userId: string, active: boolean, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await setUserActive(serverDeps(), await requireUser(), userId, active);
  });
  revalidatePath("/", "layout");
  return result;
}

export async function grantPermissionAction(userId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await grantPermission(serverDeps(), await requireUser(), {
      userId,
      permission: (str(form, "permission") ?? "") as Permission,
      clientId: str(form, "clientId"),
    });
  });
  revalidatePath("/", "layout");
  return result;
}

export async function revokePermissionAction(grantId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await revokePermission(serverDeps(), await requireUser(), grantId);
  });
  revalidatePath("/", "layout");
  return result;
}

function shiftTypeInput(form: FormData) {
  return {
    name: str(form, "name") ?? "",
    defaultStart: str(form, "defaultStart") ?? "",
    defaultEnd: str(form, "defaultEnd") ?? "",
    weekdays: form.getAll("weekdays").map(Number),
    createsTask: bool(form, "createsTask"),
  };
}

export async function createShiftTypeAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await createShiftType(serverDeps(), await requireUser(), shiftTypeInput(form));
    return t.common.saved;
  });
  revalidatePath("/", "layout");
  return result;
}

export async function updateShiftTypeAction(id: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await updateShiftType(serverDeps(), await requireUser(), id, shiftTypeInput(form));
    return t.common.saved;
  });
  revalidatePath("/", "layout");
  return result;
}
