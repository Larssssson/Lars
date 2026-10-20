"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { t } from "@/i18n";
import { createClient, removeMembership, setClientLogo, setClientStatus, setMembership, updateClient } from "@/lib/domain/clients/service";
import { DomainError } from "@/lib/domain/errors";
import type { ClientStatus } from "@/lib/generated/prisma/enums";
import { bool, runAction, str, type ActionState } from "@/lib/server/action";
import { serverDeps } from "@/lib/server/deps";
import { requireUser } from "@/lib/session";

function clientInput(form: FormData) {
  return {
    name: str(form, "name") ?? "",
    shortName: str(form, "shortName") ?? "",
    industry: str(form, "industry"),
    cluster: str(form, "cluster"),
    aiAllowed: bool(form, "aiAllowed"),
  };
}

export async function createClientAction(_state: ActionState, form: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    const client = await createClient(serverDeps(), await requireUser(), clientInput(form), str(form, "leadUserId"));
    id = client.id;
  });
  if (result?.error) return result;
  revalidatePath("/", "layout");
  redirect(`/kunden/${id}`);
}

export async function updateClientAction(clientId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await updateClient(serverDeps(), await requireUser(), clientId, clientInput(form));
    return t.common.saved;
  });
  revalidatePath("/", "layout");
  return result;
}

export async function setClientStatusAction(clientId: string, status: ClientStatus, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await setClientStatus(serverDeps(), await requireUser(), clientId, status);
  });
  revalidatePath("/", "layout");
  return result;
}

export async function uploadLogoAction(clientId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const file = form.get("logo");
    if (!(file instanceof File) || file.size === 0) throw new DomainError(t.clients.errors.logoType);
    await setClientLogo(serverDeps(), await requireUser(), clientId, {
      name: file.name,
      mimeType: file.type,
      data: new Uint8Array(await file.arrayBuffer()),
    });
    return t.common.saved;
  });
  revalidatePath("/", "layout");
  return result;
}

export async function setMembershipAction(fixedClientId: string | null, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await setMembership(serverDeps(), await requireUser(), {
      clientId: fixedClientId ?? str(form, "clientId") ?? "",
      userId: str(form, "userId") ?? "",
      kind: str(form, "kind") === "LEAD" ? "LEAD" : "TEAM",
      canApprove: bool(form, "canApprove"),
    });
  });
  revalidatePath("/", "layout");
  return result;
}

export async function removeMembershipAction(clientId: string, userId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await removeMembership(serverDeps(), await requireUser(), clientId, userId);
  });
  revalidatePath("/", "layout");
  return result;
}
