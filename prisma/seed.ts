import type { PrismaClient } from "../lib/generated/prisma/client";
import { seedClients, seedFormats, seedShiftTypes, seedUsers, type SeedUserKey } from "./seed-data";

/**
 * Seed nach BRIEFING 13. Idempotent: mehrfaches Ausführen ändert nichts.
 * Nutzer und Konfiguration sind keine Beispieldaten, alles andere trägt isSampleData = true.
 * Jede Phase ergänzt hier die Daten, die sie nutzt (DECISIONS D-031).
 */
export async function seed(db: PrismaClient): Promise<void> {
  const userIds = {} as Record<SeedUserKey, string>;
  for (const u of seedUsers) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, role: u.role, isAdmin: u.isAdmin },
    });
    userIds[u.key] = user.id;
  }

  for (const c of seedClients) {
    const client = await db.client.upsert({
      where: { shortName: c.shortName },
      update: {},
      create: {
        name: c.name,
        shortName: c.shortName,
        industry: c.industry,
        cluster: c.cluster,
        status: c.status,
        isSampleData: true,
      },
    });
    const members = [
      { userId: userIds[c.lead], kind: "LEAD" as const, canApprove: c.leadCanApprove },
      ...c.team.map((key) => ({ userId: userIds[key], kind: "TEAM" as const, canApprove: false })),
    ];
    for (const m of members) {
      await db.clientMember.upsert({
        where: { clientId_userId: { clientId: client.id, userId: m.userId } },
        update: {},
        create: { clientId: client.id, ...m, isSampleData: true },
      });
    }
  }

  for (const s of seedShiftTypes) {
    await db.shiftType.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  for (const [index, f] of seedFormats.entries()) {
    await db.documentFormat.upsert({
      where: { key: f.key },
      update: {},
      create: { ...f, builtIn: true, sortOrder: index + 1 },
    });
  }
}

async function main() {
  const { createPrismaClient } = await import("../lib/db");
  const db = createPrismaClient();
  try {
    await seed(db);
    console.info("Seed abgeschlossen.");
  } finally {
    await db.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await import("dotenv/config");
  await main();
}
