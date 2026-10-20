import type { Role } from "@/lib/generated/prisma/client";
import { ForbiddenError } from "./errors";

export { ForbiddenError };

/**
 * Rechteprüfung ausschließlich hier (BRIEFING 10.5). Jede Server Action und jeder
 * Route Handler ruft eine dieser Funktionen auf; die Oberfläche blendet nur aus.
 * Phase 0 enthält die Grundlagen, die vollständige Matrix aus 3.3 folgt in Phase 1.
 */
export type Actor = { id: string; role: Role; isAdmin: boolean; active: boolean };

export function isCvd(actor: Actor): boolean {
  return actor.active && actor.role === "CVD";
}

/** Verwaltung: CVDs und Admins (BRIEFING 4). */
export function canOpenAdministration(actor: Actor): boolean {
  return actor.active && (actor.role === "CVD" || actor.isAdmin);
}

/** Kundenauswahl in der Kopfzeile: jeder aktive Nutzer, alle Kunden sind sichtbar (BRIEFING 3.2). */
export function canSelectClient(actor: Actor): boolean {
  return actor.active;
}

export function assert(allowed: boolean): asserts allowed {
  if (!allowed) throw new ForbiddenError();
}
