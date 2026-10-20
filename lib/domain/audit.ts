import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Protokoll sicherheitsrelevanter Aktionen (BRIEFING 11, 7.10). Einträge sind unveränderlich
 * (Datenbank-Trigger). Nie Textinhalte oder Kontaktdaten protokollieren.
 */
export async function writeAudit(
  db: Db,
  entry: {
    actorId: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      createdBy: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: entry.before,
      after: entry.after,
    },
  });
}

/** Aktionen im Protokoll; Anzeige-Texte in i18n/de/admin.ts. */
export const AuditAction = {
  USER_CREATED: "USER_CREATED",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  USER_BLOCKED: "USER_BLOCKED",
  USER_UNBLOCKED: "USER_UNBLOCKED",
  PERMISSION_GRANTED: "PERMISSION_GRANTED",
  PERMISSION_REVOKED: "PERMISSION_REVOKED",
  MEMBERSHIP_SET: "MEMBERSHIP_SET",
  MEMBERSHIP_REMOVED: "MEMBERSHIP_REMOVED",
  CLIENT_CREATED: "CLIENT_CREATED",
  CLIENT_UPDATED: "CLIENT_UPDATED",
  CLIENT_STATUS_CHANGED: "CLIENT_STATUS_CHANGED",
} as const;

export type AuditActionKey = keyof typeof AuditAction;
