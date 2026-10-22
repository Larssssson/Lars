import { z } from "zod";
import { t } from "@/i18n";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { assert, type Actor } from "@/lib/domain/permissions";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { sendPush } from "./index";

/** Höchstzahl registrierter Geräte je Person (DECISIONS D-113). */
export const MAX_DEVICES = 10;

const base64url = z.string().regex(/^[A-Za-z0-9_-]+=*$/).min(16).max(200);

export const deviceSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({ p256dh: base64url, auth: base64url }),
  label: z.string().trim().max(80).optional(),
});

/** Geräte einer Person mit Bezeichnung, ohne Endpunkt und Schlüssel (nur für die Anzeige). */
export function listDevices(db: PrismaClient, userId: string) {
  return db.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, deviceLabel: true, createdAt: true } });
}

/**
 * Gerät registrieren (BRIEFING 10.3): ein Abonnement je Browser; meldet sich auf demselben
 * Gerät jemand anderes an, wandert das Abonnement zu ihm.
 */
export async function registerDevice(deps: Pick<Deps, "db">, actor: Actor, raw: unknown) {
  assert(actor.active);
  const parsed = deviceSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError(t.account.push.errors.invalid);
  const { endpoint, keys, label } = parsed.data;
  const existing = await deps.db.pushSubscription.findUnique({ where: { endpoint } });
  if (!existing || existing.userId !== actor.id) {
    const count = await deps.db.pushSubscription.count({ where: { userId: actor.id } });
    if (count >= MAX_DEVICES) throw new DomainError(t.account.push.errors.tooMany(MAX_DEVICES));
  }
  return deps.db.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: actor.id, keys, deviceLabel: label || null, updatedBy: actor.id },
    create: { userId: actor.id, endpoint, keys, deviceLabel: label || null, createdBy: actor.id, updatedBy: actor.id },
  });
}

/** Gerät entfernen: nur eigene Geräte. */
export async function removeDevice(deps: Pick<Deps, "db">, actor: Actor, deviceId: string) {
  const device = await deps.db.pushSubscription.findUnique({ where: { id: deviceId } });
  if (!device) throw new NotFoundError(t.errors.notFound);
  assert(device.userId === actor.id);
  await deps.db.pushSubscription.delete({ where: { id: device.id } });
}

/**
 * Testnachricht an die eigenen Geräte (BRIEFING 10.3). Sie steht auch in der Glocke und zählt
 * als Push-Nachricht (7.9). Gibt die Zahl der erreichten Geräte zurück.
 */
export async function sendTestPush(deps: Pick<Deps, "db" | "push">, actor: Actor, deviceId?: string): Promise<number> {
  assert(actor.active);
  if (deviceId) {
    const device = await deps.db.pushSubscription.findUnique({ where: { id: deviceId } });
    if (!device || device.userId !== actor.id) throw new NotFoundError(t.errors.notFound);
  }
  if (!(await deps.db.pushSubscription.count({ where: { userId: actor.id } }))) throw new DomainError(t.account.push.errors.noDevice);
  const notification = await deps.db.notification.create({
    data: { userId: actor.id, kind: "PUSH_TEST", title: t.notifications.testTitle, link: "/profil", isPush: true, createdBy: actor.id },
  });
  return sendPush(
    deps,
    { userId: actor.id, notificationId: notification.id, title: t.notifications.testTitle, body: t.notifications.testBody, link: "/profil" },
    deviceId ? [deviceId] : undefined,
  );
}
