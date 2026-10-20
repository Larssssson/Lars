import { z } from "zod";
import { t } from "@/i18n";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { assert, canManageShifts, type Actor } from "@/lib/domain/permissions";
import type { PrismaClient, ShiftType } from "@/lib/generated/prisma/client";
import { addDays, atTime, dateKey, mondayOf, parseKey, weekdayOf, type DateKey } from "@/lib/time";

/** Kalendertag als Wert für die Date-Spalte (Mitternacht UTC). */
export function dateColumn(key: DateKey): Date {
  const { year, month, day } = parseKey(key);
  return new Date(Date.UTC(year, month - 1, day));
}

export function keyFromColumn(date: Date): DateKey {
  return date.toISOString().slice(0, 10);
}

/** Beginn und Ende eines Dienstes aus den Standardzeiten des Typs (Ortszeit Berlin, DECISIONS D-042). */
export function shiftTimes(type: Pick<ShiftType, "defaultStart" | "defaultEnd">, key: DateKey): { start: Date; end: Date } {
  const start = atTime(key, type.defaultStart);
  let end = atTime(key, type.defaultEnd);
  if (end <= start) end = atTime(addDays(key, 1), type.defaultEnd);
  return { start, end };
}

/** Wochenansicht: eine Zeile pro Diensttyp, eine Spalte pro Tag (BRIEFING 7.8). */
export async function weekView(db: PrismaClient, anyDayOfWeek: DateKey) {
  const monday = mondayOf(anyDayOfWeek);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const [types, shifts] = await Promise.all([
    db.shiftType.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.shift.findMany({
      where: { date: { gte: dateColumn(days[0]!), lte: dateColumn(days[6]!) } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { start: "asc" },
    }),
  ]);
  const cells = new Map<string, { id: string; userId: string; userName: string }[]>();
  for (const s of shifts) {
    const k = `${s.shiftTypeId}|${keyFromColumn(s.date)}`;
    const list = cells.get(k) ?? [];
    list.push({ id: s.id, userId: s.user.id, userName: s.user.name });
    cells.set(k, list);
  }
  return {
    monday,
    days,
    rows: types.map((type) => ({
      type,
      cells: days.map((day) => ({ day, allowed: type.weekdays.includes(weekdayOf(day)), entries: cells.get(`${type.id}|${day}`) ?? [] })),
    })),
  };
}

/** Dienste eines Tages für die Leiste auf dem Dashboard (BRIEFING 7.1). */
export async function shiftsOn(db: PrismaClient, key: DateKey) {
  return db.shift.findMany({
    where: { date: dateColumn(key) },
    include: { shiftType: true, user: { select: { id: true, name: true } } },
    orderBy: [{ shiftType: { sortOrder: "asc" } }, { start: "asc" }],
  });
}

/** CVD vom Dienst zum Zeitpunkt now (für die Eskalation in Phase 2/6). */
export async function cvdOnDuty(db: PrismaClient, now: Date) {
  const shift = await db.shift.findFirst({
    where: { shiftType: { key: "CVD_VOM_DIENST" }, start: { lte: now }, end: { gt: now }, user: { active: true } },
    include: { user: true },
  });
  return shift?.user ?? null;
}

export async function assignShift(deps: Deps, actor: Actor, input: { shiftTypeId: string; day: DateKey; userId: string }) {
  assert(canManageShifts(actor));
  const type = await deps.db.shiftType.findUnique({ where: { id: input.shiftTypeId } });
  if (!type) throw new NotFoundError(t.errors.notFound);
  if (!type.weekdays.includes(weekdayOf(input.day))) throw new DomainError(t.shifts.errors.dayNotAllowed);
  const user = await deps.db.user.findFirst({ where: { id: input.userId, active: true } });
  if (!user) throw new DomainError(t.shifts.errors.userInvalid);
  const { start, end } = shiftTimes(type, input.day);
  const date = dateColumn(input.day);
  return deps.db.shift.upsert({
    where: { shiftTypeId_date_userId: { shiftTypeId: type.id, date, userId: user.id } },
    update: {},
    create: { shiftTypeId: type.id, userId: user.id, date, start, end, createdBy: actor.id, updatedBy: actor.id },
  });
}

export async function removeShift(deps: Deps, actor: Actor, shiftId: string): Promise<void> {
  assert(canManageShifts(actor));
  await deps.db.shift.deleteMany({ where: { id: shiftId } });
}

/**
 * Woche kopieren (BRIEFING 7.8): alle Dienste der Quellwoche in die Zielwoche, gleicher Wochentag.
 * Vorhandene Einträge der Zielwoche bleiben, Dubletten entstehen nicht (DECISIONS D-047).
 */
export async function copyWeek(deps: Deps, actor: Actor, fromDay: DateKey, toDay: DateKey): Promise<number> {
  assert(canManageShifts(actor));
  const from = mondayOf(fromDay);
  const to = mondayOf(toDay);
  if (from === to) throw new DomainError(t.shifts.errors.sameWeek);
  const shifts = await deps.db.shift.findMany({
    where: { date: { gte: dateColumn(from), lte: dateColumn(addDays(from, 6)) } },
    include: { shiftType: true, user: { select: { active: true } } },
  });
  let created = 0;
  for (const s of shifts) {
    if (!s.user.active) continue;
    const offset = weekdayOf(keyFromColumn(s.date)) - 1;
    const day = addDays(to, offset);
    const { start, end } = shiftTimes(s.shiftType, day);
    const date = dateColumn(day);
    const exists = await deps.db.shift.findUnique({
      where: { shiftTypeId_date_userId: { shiftTypeId: s.shiftTypeId, date, userId: s.userId } },
    });
    if (exists) continue;
    await deps.db.shift.create({
      data: { shiftTypeId: s.shiftTypeId, userId: s.userId, date, start, end, createdBy: actor.id, updatedBy: actor.id },
    });
    created += 1;
  }
  return created;
}

/** Diensttypen in der Verwaltung (BRIEFING 7.8, 7.10). */
export const shiftTypeSchema = z.object({
  name: z.string().trim().min(1, t.shifts.errors.nameRequired).max(80),
  defaultStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, t.shifts.errors.timeInvalid),
  defaultEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, t.shifts.errors.timeInvalid),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1, t.shifts.errors.weekdaysRequired),
  createsTask: z.boolean().default(false),
});

export async function createShiftType(deps: Deps, actor: Actor, raw: z.input<typeof shiftTypeSchema>) {
  assert(canManageShifts(actor));
  const input = shiftTypeSchema.parse(raw);
  const key = input.name
    .toUpperCase()
    .replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE").replace(/ß/g, "SS")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const count = await deps.db.shiftType.count();
  const existing = await deps.db.shiftType.findUnique({ where: { key } });
  return deps.db.shiftType.create({
    data: { ...input, key: existing ? `${key}_${count + 1}` : key, sortOrder: count + 1, createdBy: actor.id, updatedBy: actor.id },
  });
}

export async function updateShiftType(deps: Deps, actor: Actor, id: string, raw: z.input<typeof shiftTypeSchema>) {
  assert(canManageShifts(actor));
  const input = shiftTypeSchema.parse(raw);
  return deps.db.shiftType.update({ where: { id }, data: { ...input, updatedBy: actor.id } });
}

export function todayKeyFor(now: Date): DateKey {
  return dateKey(now);
}
