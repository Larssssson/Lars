"use server";

import { revalidatePath } from "next/cache";
import { t } from "@/i18n";
import { createUser, grantPermission, revokePermission, setUserActive, setUserRole } from "@/lib/domain/permissions/admin";
import { completeOffboarding, reassignTask, resolveOwnedContact, type ContactResolution } from "@/lib/domain/permissions/offboarding";
import { createFormat, updateFormat } from "@/lib/domain/documents/formats";
import { createShiftType, updateShiftType } from "@/lib/domain/shifts";
import { updateAiModels, updateGeneralSettings, updateRpTemplate } from "@/lib/domain/settings";
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
    taskDueTime: str(form, "taskDueTime"),
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

function formatInput(form: FormData) {
  return {
    name: str(form, "name") ?? "",
    blocks: str(form, "blocks") ?? "",
    rulesText: str(form, "rulesText"),
    sharePointFolder: str(form, "sharePointFolder") ?? "",
  };
}

export async function createFormatAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await createFormat(serverDeps(), await requireUser(), formatInput(form));
    return t.common.saved;
  });
  revalidatePath("/", "layout");
  return result;
}

export async function updateFormatAction(id: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await updateFormat(serverDeps(), await requireUser(), id, formatInput(form));
    return t.common.saved;
  });
  revalidatePath("/", "layout");
  return result;
}

// ------------------------------------------------------------- Offboarding (BRIEFING 6.9)

export async function reassignTaskAction(offboardUserId: string, taskId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => reassignTask(serverDeps(), await requireUser(), offboardUserId, taskId, str(form, "ownerId") ?? ""));
  revalidatePath(`/verwaltung/nutzer/${offboardUserId}/offboarding`);
  return result;
}

export async function resolveContactAction(offboardUserId: string, ownerRowId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const kind = str(form, "kind");
  const resolution: ContactResolution =
    kind === "TRANSFER" ? { kind, userId: str(form, "userId") ?? "" } : kind === "NOTE" ? { kind, note: str(form, "note") ?? "" } : { kind: "INACTIVE" };
  const result = await runAction(async () => resolveOwnedContact(serverDeps(), await requireUser(), offboardUserId, ownerRowId, resolution));
  revalidatePath(`/verwaltung/nutzer/${offboardUserId}/offboarding`);
  return result;
}

export async function completeOffboardingAction(offboardUserId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await completeOffboarding(serverDeps(), await requireUser(), offboardUserId);
    return t.admin.offboarding.completed;
  });
  revalidatePath("/verwaltung", "layout");
  return result;
}

export async function updateGeneralSettingsAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await updateGeneralSettings(serverDeps(), await requireUser(), {
      escalationFirstMinutes: str(form, "escalationFirstMinutes"),
      escalationSecondMinutes: str(form, "escalationSecondMinutes"),
      relevanceThreshold: str(form, "relevanceThreshold"),
      topArticles: str(form, "topArticles"),
    });
    return t.admin.settings.saved;
  });
  revalidatePath("/", "layout");
  return result;
}

export async function updateRpTemplateAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const logo = form.get("logo");
    await updateRpTemplate(serverDeps(), await requireUser(), {
      color: str(form, "color") ?? "",
      font: str(form, "font") ?? "",
      logo: logo instanceof File && logo.size > 0 ? { name: logo.name, mimeType: logo.type, data: new Uint8Array(await logo.arrayBuffer()) } : null,
    });
    return t.admin.settings.saved;
  });
  revalidatePath("/verwaltung", "layout");
  return result;
}

export async function updateAiModelsAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await updateAiModels(serverDeps(), await requireUser(), { quality: str(form, "quality") ?? "", fast: str(form, "fast") ?? "" });
    return t.admin.settings.saved;
  });
  revalidatePath("/verwaltung", "layout");
  return result;
}
