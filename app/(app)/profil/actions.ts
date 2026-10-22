"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { t } from "@/i18n";
import { adapters } from "@/lib/adapters";
import { DomainError } from "@/lib/domain/errors";
import { registerDevice, removeDevice, sendTestPush } from "@/lib/domain/notifications/devices";
import { runAction, type ActionState } from "@/lib/server/action";
import { serverDeps } from "@/lib/server/deps";
import { requireUser } from "@/lib/session";

const refresh = () => revalidatePath("/profil");

/** Abonnement aus PushManager.subscribe() registrieren (BRIEFING 10.3). */
export async function registerDeviceAction(subscription: unknown, label: string): Promise<ActionState> {
  const result = await runAction(async () => {
    const sub = (subscription ?? {}) as { endpoint?: unknown; keys?: unknown };
    await registerDevice(serverDeps(), await requireUser(), { endpoint: sub.endpoint, keys: sub.keys, label });
    return t.account.push.registered;
  });
  refresh();
  return result;
}

/**
 * Nur im Ersatz-Modus (PUSH_PROVIDER=mock): ein Gerät ohne Push-Dienst registrieren, damit sich
 * Geräteliste und Testnachricht lokal ausprobieren lassen.
 */
export async function registerMockDeviceAction(label: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    if (adapters.push().kind !== "mock") throw new DomainError(t.account.push.errors.invalid);
    const key = (n: number) => Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString("base64url");
    await registerDevice(serverDeps(), await requireUser(), {
      endpoint: `https://push.invalid/ersatz/${crypto.randomUUID()}`,
      keys: { p256dh: key(65), auth: key(16) },
      label: label || t.account.push.unnamed,
    });
    return t.account.push.registered;
  });
  refresh();
  return result;
}

export async function removeDeviceAction(deviceId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await removeDevice(serverDeps(), await requireUser(), z.uuid().parse(deviceId));
    return t.account.push.removed;
  });
  refresh();
  return result;
}

export async function testPushAction(_state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    const n = await sendTestPush(serverDeps(), await requireUser());
    return t.account.push.testSent(n);
  });
  revalidatePath("/", "layout");
  return result;
}
