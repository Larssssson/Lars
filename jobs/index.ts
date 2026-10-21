import { adapters } from "../lib/adapters";
import { prisma } from "../lib/db";
import { notifyClientWarnings } from "../lib/domain/clients/service";
import type { Deps } from "../lib/domain/deps";
import { weeklyContactMaintenance } from "../lib/domain/journo/maintenance";
import { remindOpenRequests } from "../lib/domain/journo/requests";
import { archiveCompletedTasks, recalculatePriorities } from "../lib/domain/tasks/service";

/**
 * Hintergrundjobs mit Zeitplan (BRIEFING 10.1, 16). Zeitpläne in Europe/Berlin.
 * Weitere Jobs kommen mit ihren Phasen dazu (Eskalation, Erinnerungen, Pressespiegel-Aufgabe,
 * wöchentliche Pflege, Volltexte löschen).
 */
export type JobDefinition = {
  name: string;
  /** Cron-Ausdruck, null = nur auf Anforderung */
  cron: string | null;
  description: string;
  handler: (deps: Deps) => Promise<unknown>;
};

export const jobs: JobDefinition[] = [
  {
    name: "prioritaet-neu-berechnen",
    cron: "*/5 * * * *",
    description: "Priorität aller offenen Aufgaben aus der Frist neu bestimmen, Owner bei Übergang nach Dringend benachrichtigen (6.2).",
    handler: recalculatePriorities,
  },
  {
    name: "archivierung",
    cron: "30 2 * * *",
    description: "Aufgaben 30 Tage nach Erledigt archivieren (6.3).",
    handler: archiveCompletedTasks,
  },
  {
    name: "kunden-warnungen",
    cron: "0 7 * * *",
    description: "Profilwarnungen und Leistungsrückstand in die Glocke von Kunden-Lead und CVDs (7.9).",
    handler: notifyClientWarnings,
  },
  {
    name: "kontaktanfragen-erinnern",
    cron: "0 * * * *",
    description: "Owner einmal erinnern, wenn eine Kontaktanfrage 24 Stunden unbeantwortet ist (6.7).",
    handler: remindOpenRequests,
  },
  {
    name: "journo-pflege",
    cron: "0 6 * * 1",
    description: "Mögliche Dubletten und Kontakte ohne Aktivität seit 24 Monaten den CVDs vorlegen (7.5).",
    handler: weeklyContactMaintenance,
  },
];

export function jobDeps(): Deps {
  return { db: prisma, push: adapters.push(), files: adapters.fileStorage(), documents: adapters.documentStore(), ai: adapters.ai(), now: () => new Date() };
}
