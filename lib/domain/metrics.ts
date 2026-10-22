import type { Deps } from "@/lib/domain/deps";
import { assert, canManageTechnicalSettings, type Actor } from "@/lib/domain/permissions";
import type { PrismaClient, TaskStatus } from "@/lib/generated/prisma/client";
import { addDays, dateKey, mondayOf, parseKey, startOfDay, toKey, type DateKey } from "@/lib/time";

const WEEKS = 8;
const PUSH_DAYS = 14;
const MONTHS = 6;
const WINDOW_DAYS = 30;

/** Datum einer @db.Date-Spalte für einen Berliner Kalendertag. */
const column = (key: DateKey) => new Date(`${key}T00:00:00.000Z`);
const keyOfColumn = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Nutzung festhalten: ein Eintrag je Nutzer und Tag (für "aktive Nutzer pro Woche").
 * Ohne Inhalte, ohne Uhrzeit; doppelte Einträge verhindert der eindeutige Schlüssel.
 */
export async function recordActivity(db: Pick<PrismaClient, "userActivity">, userId: string, now: Date): Promise<void> {
  await db.userActivity.createMany({ data: [{ userId, day: column(dateKey(now)), createdBy: userId }], skipDuplicates: true });
}

export type Metrics = {
  activeUsersPerWeek: { week: DateKey; users: number }[];
  tasksByStatus: { status: TaskStatus; count: number }[];
  approvalTime: { minutes: number | null; count: number };
  pushPerPersonDay: { name: string; day: DateKey; count: number }[];
  verifiedContacts: { month: string; count: number }[];
  reviewShifts: { done: number; total: number };
};

/** Kennzahlen der Verwaltung (BRIEFING 7.10), nur für Admins (BRIEFING 3.1). */
export async function metrics(deps: Pick<Deps, "db" | "now">, actor: Actor): Promise<Metrics> {
  assert(canManageTechnicalSettings(actor));
  const { db } = deps;
  const now = deps.now();
  const today = dateKey(now);
  const windowStart = startOfDay(addDays(today, -WINDOW_DAYS));

  // aktive Nutzer pro Woche (Montag bis Sonntag), die letzten 8 Wochen
  const firstMonday = addDays(mondayOf(today), -7 * (WEEKS - 1));
  const activity = await db.userActivity.findMany({ where: { day: { gte: column(firstMonday) } }, select: { userId: true, day: true } });
  const activeUsersPerWeek = Array.from({ length: WEEKS }, (_, i) => {
    const week = addDays(firstMonday, 7 * i);
    const users = new Set(activity.filter((a) => mondayOf(keyOfColumn(a.day)) === week).map((a) => a.userId));
    return { week, users: users.size };
  });

  const statusGroups = await db.task.groupBy({ by: ["status"], _count: { _all: true } });
  const tasksByStatus = statusGroups.map((g) => ({ status: g.status, count: g._count._all }));

  // mittlere Freigabezeit: Anfrage bis Entscheidung, Entscheidungen der letzten 30 Tage
  const decided = await db.approval.findMany({
    where: { decidedAt: { gte: windowStart }, decision: { in: ["FREIGEGEBEN", "AENDERUNGEN"] } },
    select: { requestedAt: true, decidedAt: true },
  });
  const durations = decided.map((a) => (a.decidedAt!.getTime() - a.requestedAt.getTime()) / 60_000);
  const approvalTime = { minutes: durations.length ? durations.reduce((x, y) => x + y, 0) / durations.length : null, count: durations.length };

  // Push-Nachrichten pro Person und Tag (BRIEFING 7.9: jede wird gezählt)
  const pushes = await db.notification.findMany({
    where: { isPush: true, createdAt: { gte: startOfDay(addDays(today, -(PUSH_DAYS - 1))) } },
    select: { createdAt: true, user: { select: { name: true } } },
  });
  const pushCounts = new Map<string, { name: string; day: DateKey; count: number }>();
  for (const p of pushes) {
    const day = dateKey(p.createdAt);
    const key = `${day}|${p.user.name}`;
    const entry = pushCounts.get(key) ?? { name: p.user.name, day, count: 0 };
    entry.count += 1;
    pushCounts.set(key, entry);
  }
  const pushPerPersonDay = [...pushCounts.values()].sort((a, b) => b.day.localeCompare(a.day) || a.name.localeCompare(b.name));

  // verifizierte Kontakte im Zeitverlauf: Stand am Ende der letzten 6 Monate
  const { year, month } = parseKey(today);
  const verifiedContacts = [];
  const firstOf = (offset: number) => {
    const d = new Date(Date.UTC(year, month - 1 + offset, 1));
    return toKey(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  };
  for (let i = MONTHS - 1; i >= 0; i--) {
    // Stand am Monatsende, im laufenden Monat heute
    const end = i === 0 ? now : startOfDay(firstOf(1 - i));
    const count = await db.journalist.count({ where: { verifiedAt: { not: null, lt: end } } });
    verifiedContacts.push({ month: firstOf(-i).slice(0, 7), count });
  }

  // Pressespiegel-Dienste der letzten 30 Tage bis heute und wie viele davon erledigt sind
  const shifts = await db.shift.findMany({
    where: { shiftType: { createsTask: true }, date: { gte: column(addDays(today, -WINDOW_DAYS)), lte: column(today) } },
    select: { taskId: true },
  });
  const taskIds = shifts.flatMap((s) => (s.taskId ? [s.taskId] : []));
  const done = taskIds.length ? await db.task.count({ where: { id: { in: taskIds }, status: { in: ["ERLEDIGT", "ARCHIVIERT"] } } }) : 0;

  return { activeUsersPerWeek, tasksByStatus, approvalTime, pushPerPersonDay, verifiedContacts, reviewShifts: { done, total: shifts.length } };
}
