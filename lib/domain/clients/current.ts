import type { PrismaClient } from "@/lib/generated/prisma/client";

/** Name des in der Kopfzeile gewählten Kunden oder null bei "Alle Kunden". */
export async function selectedClientName(db: PrismaClient, selectedClientId: string | null): Promise<string | null> {
  if (!selectedClientId) return null;
  const client = await db.client.findUnique({ where: { id: selectedClientId }, select: { name: true } });
  return client?.name ?? null;
}
