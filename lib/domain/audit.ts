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
  APPROVAL_GRANTED: "APPROVAL_GRANTED",
  SELF_APPROVAL: "SELF_APPROVAL",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
  CONTACT_REVEALED: "CONTACT_REVEALED",
  CONTACT_VERIFIED: "CONTACT_VERIFIED",
  CONTACT_VERIFICATION_REVOKED: "CONTACT_VERIFICATION_REVOKED",
  CONTACT_ACCESS_GRANTED: "CONTACT_ACCESS_GRANTED",
  CONTACT_OWNER_APPROVED: "CONTACT_OWNER_APPROVED",
  CONTACT_EXPORTED: "CONTACT_EXPORTED",
  CONTACT_DELETED: "CONTACT_DELETED",
  USER_OFFBOARDED: "USER_OFFBOARDED",
} as const;

export type AuditActionKey = keyof typeof AuditAction;
