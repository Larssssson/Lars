import type { PushSender } from "@/lib/adapters";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { assert, type Actor } from "@/lib/domain/permissions";
import { NotFoundError } from "@/lib/domain/errors";
import { t } from "@/i18n";

/**
 * Ereignisse der Glocke (BRIEFING 7.9). Push nur, wo die Tabelle es vorsieht;
 * jede Push-Nachricht ist zusätzlich ein Eintrag in der Glocke (isPush = true).
 */
export const NotificationKind = {
  TASK_ASSIGNED: "TASK_ASSIGNED",
  TASK_URGENT: "TASK_URGENT",
  PROFILE_WARNING: "PROFILE_WARNING",
  SERVICE_BACKLOG: "SERVICE_BACKLOG",
  APPROVAL_REQUESTED: "APPROVAL_REQUESTED",
  APPROVAL_DECIDED: "APPROVAL_DECIDED",
  COMMENT: "COMMENT",
  LOCK_REQUESTED: "LOCK_REQUESTED",
} as const;

export type NotificationKindKey = keyof typeof NotificationKind;

export type NotifyInput = {
  userId: string;
  kind: NotificationKindKey;
  title: string;
  link: string;
  push: boolean;
  /** Text der Push-Nachricht: Kunde, Aufgabe, Frist (BRIEFING 7.9) */
  pushBody?: string;
};

export async function notify(deps: { db: PrismaClient; push: PushSender }, input: NotifyInput): Promise<void> {
  const notification = await deps.db.notification.create({
    data: { userId: input.userId, kind: input.kind, title: input.title, link: input.link, isPush: input.push },
  });
  if (input.push) {
    await deps.push.send({
      userId: input.userId,
      notificationId: notification.id,
      title: t.notifications.pushTitle,
      body: input.pushBody ?? input.title,
      link: input.link,
    });
  }
}

export function listNotifications(db: PrismaClient, userId: string, limit = 50) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
}

export function unreadCount(db: PrismaClient, userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(db: PrismaClient, actor: Actor, notificationId: string, now: Date): Promise<void> {
  const n = await db.notification.findUnique({ where: { id: notificationId } });
  if (!n) throw new NotFoundError(t.errors.notFound);
  assert(n.userId === actor.id);
  if (!n.readAt) await db.notification.update({ where: { id: n.id }, data: { readAt: now } });
}

export async function markAllRead(db: PrismaClient, actor: Actor, now: Date): Promise<void> {
  await db.notification.updateMany({ where: { userId: actor.id, readAt: null }, data: { readAt: now } });
}
