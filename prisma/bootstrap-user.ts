import { AuditAction, writeAudit } from "../lib/domain/audit";
import { userSchema } from "../lib/domain/permissions/admin";
import type { PrismaClient, User } from "../lib/generated/prisma/client";

/**
 * Ersten echten CVD für den Livegang anlegen (OPERATIONS.md): Die Seed-Nutzer haben Beispiel-
 * Adressen und können sich über Entra ID nicht anmelden. Weitere Nutzer legt der CVD in der
 * Verwaltung an. Vorhandene Nutzer mit derselben Mailadresse werden CVD und Admin.
 */
export async function bootstrapCvd(db: PrismaClient, input: { name: string; email: string }): Promise<User> {
  const parsed = userSchema.parse({ ...input, role: "CVD", isAdmin: true });
  const existing = await db.user.findFirst({ where: { email: { equals: parsed.email, mode: "insensitive" } } });
  const user = existing
    ? await db.user.update({ where: { id: existing.id }, data: { role: "CVD", isAdmin: true, active: true, deactivatedAt: null } })
    : await db.user.create({ data: parsed });
  await writeAudit(db, {
    actorId: null,
    action: existing ? AuditAction.USER_ROLE_CHANGED : AuditAction.USER_CREATED,
    entity: "User",
    entityId: user.id,
    after: { role: "CVD", isAdmin: true, via: "bootstrap" },
  });
  return user;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await import("dotenv/config");
  const [name, email] = process.argv.slice(2);
  if (!name || !email) {
    console.error('Aufruf: npm run user:bootstrap -- "Vorname Nachname" name@firma.de');
    process.exit(1);
  }
  const { createPrismaClient } = await import("../lib/db");
  const db = createPrismaClient();
  try {
    const user = await bootstrapCvd(db, { name, email });
    // keine Mailadresse ins Log (Arbeitsregel 6)
    console.info(`CVD mit Admin-Recht bereit (Nutzer ${user.id}).`);
  } finally {
    await db.$disconnect();
  }
}
