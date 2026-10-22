import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

/** Interner Eintrag für kundenübergreifende Aufgaben wie den täglichen Pressespiegel (DECISIONS D-101). */
export const INTERNAL_CLIENT = { name: "RP intern", shortName: "RP intern" } as const;

/** ID von "RP intern"; legt den Eintrag beim ersten Bedarf an (Konfiguration, keine Beispieldaten). */
export async function internalClientId(db: PrismaClient | Prisma.TransactionClient): Promise<string> {
  const existing = await db.client.findFirst({ where: { isInternal: true }, select: { id: true } });
  if (existing) return existing.id;
  const created = await db.client.upsert({
    where: { shortName: INTERNAL_CLIENT.shortName },
    update: { isInternal: true },
    create: { ...INTERNAL_CLIENT, status: "AKTIV", isInternal: true },
  });
  return created.id;
}
