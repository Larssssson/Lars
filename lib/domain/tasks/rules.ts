import type { ManualPriority, Priority, TaskStatus, TaskType } from "@/lib/generated/prisma/enums";
import { addDays, addWorkdays, atTime, berlinParts, dateKey } from "@/lib/time";

/** Rangfolge für die Sortierung (BRIEFING 6.2). */
export const PRIORITY_RANK: Record<Priority, number> = { DRINGEND: 0, HOCH: 1, NORMAL: 2, NIEDRIG: 3 };

const TWO_HOURS = 2 * 60 * 60 * 1000;

/**
 * Priorität aus Frist und CVD-Markierung (BRIEFING 6.2, Grenzen nach DECISIONS D-013):
 * Dringend ≤ 2 Std oder überschritten oder markiert; Hoch = Frist heute; Normal = bis Ende
 * des dritten Werktags nach heute; Niedrig = später.
 */
export function computePriority(dueAt: Date, manual: ManualPriority | null, now: Date): Priority {
  if (manual === "DRINGEND") return "DRINGEND";
  if (dueAt.getTime() - now.getTime() <= TWO_HOURS) return "DRINGEND";
  const today = dateKey(now);
  const dueDay = dateKey(dueAt);
  if (dueDay === today) return "HOCH";
  if (dueDay <= addWorkdays(today, 3)) return "NORMAL";
  return "NIEDRIG";
}

/** Sortierung in allen Listen: Priorität, dann Frist, dann Anlagedatum (BRIEFING 6.2). */
export function compareTasks(
  a: { priority: Priority; dueAt: Date; createdAt: Date },
  b: { priority: Priority; dueAt: Date; createdAt: Date },
): number {
  return (
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.dueAt.getTime() - b.dueAt.getTime() ||
    a.createdAt.getTime() - b.createdAt.getTime()
  );
}

/** Gruppen auf dem Dashboard (DECISIONS D-016). */
export type DashboardGroup = "DRINGEND" | "HEUTE" | "DEMNAECHST";

export function dashboardGroup(priority: Priority): DashboardGroup {
  if (priority === "DRINGEND") return "DRINGEND";
  if (priority === "HOCH") return "HEUTE";
  return "DEMNAECHST";
}

/** Schnellwahl für die Frist (BRIEFING 6.1). Vorbelegt: in 3 Werktagen (DECISIONS D-015). */
export type DueOption = "IN_2_STUNDEN" | "HEUTE_17" | "MORGEN_12" | "IN_3_WERKTAGEN";

export function dueOptions(now: Date): Record<DueOption, Date> {
  const today = dateKey(now);
  const p = berlinParts(now);
  const time = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  return {
    IN_2_STUNDEN: new Date(now.getTime() + TWO_HOURS),
    HEUTE_17: atTime(today, "17:00"),
    MORGEN_12: atTime(addDays(today, 1), "12:00"),
    IN_3_WERKTAGEN: atTime(addWorkdays(today, 3), time),
  };
}

export const DEFAULT_DUE_OPTION: DueOption = "IN_3_WERKTAGEN";

/** Status, die als offen gelten (nicht erledigt, nicht archiviert). */
export const OPEN_STATUSES: TaskStatus[] = [
  "OFFEN",
  "IN_BEARBEITUNG",
  "FREIGABE_ANGEFRAGT",
  "AENDERUNGEN_ANGEFORDERT",
  "FREIGEGEBEN",
  "BEIM_KUNDEN",
];

export function isOpen(status: TaskStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

/** Status je Aufgabentyp (BRIEFING 6.3). */
export const STATUSES_BY_TYPE: Record<TaskType, TaskStatus[]> = {
  DOKUMENT: [...OPEN_STATUSES, "ERLEDIGT", "ARCHIVIERT"],
  AUFGABE: ["OFFEN", "IN_BEARBEITUNG", "ERLEDIGT", "ARCHIVIERT"],
};

/**
 * Übergänge für einfache Aufgaben: Offen ↔ In Bearbeitung, beide → Erledigt,
 * Erledigt → wieder In Bearbeitung oder Archiviert. Archiviert ist endgültig.
 * Dokument-Aufgaben wechseln ihren Status über Editor, Freigabe und Versand (Phase 2).
 */
export const SIMPLE_TASK_TRANSITIONS: Record<"OFFEN" | "IN_BEARBEITUNG" | "ERLEDIGT" | "ARCHIVIERT", TaskStatus[]> = {
  OFFEN: ["IN_BEARBEITUNG", "ERLEDIGT"],
  IN_BEARBEITUNG: ["OFFEN", "ERLEDIGT"],
  ERLEDIGT: ["IN_BEARBEITUNG", "ARCHIVIERT"],
  ARCHIVIERT: [],
};

export function canTransitionSimpleTask(from: TaskStatus, to: TaskStatus): boolean {
  const allowed = (SIMPLE_TASK_TRANSITIONS as Record<string, TaskStatus[] | undefined>)[from];
  return allowed?.includes(to) ?? false;
}

/** Archivierung 30 Tage nach Erledigt (BRIEFING 6.3, DECISIONS D-020). */
export const ARCHIVE_AFTER_DAYS = 30;

