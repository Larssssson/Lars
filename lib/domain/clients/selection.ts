import type { PrismaClient } from "@/lib/generated/prisma/client";
import { t } from "@/i18n";
import { assert, canSelectClient, type Actor } from "@/lib/domain/permissions";

/** Kundenauswahl der Kopfzeile speichern (BRIEFING 4); null = "Alle Kunden". */
export async function setSelectedClient(db: PrismaClient, actor: Actor, clientId: string | null): Promise<void> {
  assert(canSelectClient(actor));
  if (clientId !== null) {
    const client = await db.client.findUnique({ where: { id: clientId }, select: { status: true } });
    if (!client || client.status === "ARCHIVIERT") throw new Error(t.errors.clientNotSelectable);
  }
  await db.user.update({
    where: { id: actor.id },
    data: { selectedClientId: clientId, updatedBy: actor.id },
  });
}

/** Kunden für die Auswahl: alle nicht archivierten, alphabetisch. */
export function listSelectableClients(db: PrismaClient) {
  return db.client.findMany({
    where: { status: { not: "ARCHIVIERT" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, shortName: true, status: true },
  });
}
