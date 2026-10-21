import type { PrismaClient } from "@/lib/generated/prisma/client";
import { linkedinAvailable } from "./actions";
import { activeClients } from "./relevance";

export type CardClient = { id: string; name: string; linkedin: boolean };

/** Kunden für die Artikelkarten: der gewählte Kunde oder alle aktiven (Kunde ist Filter, Grundsatz 5). */
export async function cardClients(db: PrismaClient, selectedClientId: string | null): Promise<CardClient[]> {
  const clients = (await activeClients(db)).filter((c) => !selectedClientId || c.id === selectedClientId);
  return Promise.all(clients.map(async (c) => ({ id: c.id, name: c.name, linkedin: await linkedinAvailable({ db }, c.id) })));
}
