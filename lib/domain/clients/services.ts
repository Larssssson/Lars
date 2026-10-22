import type { AgreedService, PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Stand einer vereinbarten Leistung (DECISIONS D-008): erledigte Aufgaben mit dieser Leistung
 * im Zeitraum plus abgeschlossene Projekte mit dieser Leistung.
 */
export async function doneCount(db: PrismaClient, service: Pick<AgreedService, "id" | "periodStart" | "periodEnd">): Promise<number> {
  const [tasks, projects] = await Promise.all([
    db.task.count({
      where: {
        agreedServiceId: service.id,
        status: { in: ["ERLEDIGT", "ARCHIVIERT"] },
        completedAt: { gte: service.periodStart, lte: service.periodEnd },
      },
    }),
    db.project.count({ where: { agreedServiceId: service.id, status: "ABGESCHLOSSEN" } }),
  ]);
  return tasks + projects;
}

/**
 * Rückstand (BRIEFING 7.1): weniger als die Hälfte erledigt, wenn mehr als die Hälfte des
 * Zeitraums vorbei ist, oder der Zeitraum endet in 30 Tagen und es fehlt noch etwas.
 */
export function isBehind(
  service: Pick<AgreedService, "targetCount" | "periodStart" | "periodEnd">,
  done: number,
  now: Date,
): boolean {
  if (done >= service.targetCount) return false;
  const start = service.periodStart.getTime();
  const end = service.periodEnd.getTime();
  const t = now.getTime();
  if (t < start || t > end) return false;
  const moreThanHalfElapsed = t - start > (end - start) / 2;
  if (moreThanHalfElapsed && done < service.targetCount / 2) return true;
  return end - t <= 30 * 86_400_000;
}

/** Verbleibende ganze Wochen bis zum Ende des Zeitraums. */
export function weeksLeft(periodEnd: Date, now: Date): number {
  return Math.max(0, Math.floor((periodEnd.getTime() - now.getTime()) / (7 * 86_400_000)));
}

/** Bezeichnung des Zeitraums, z. B. "2. Halbjahr 2026", "4. Quartal 2026". */
export function periodLabel(start: Date, end: Date): string {
  const s = new Date(start.getTime() + 12 * 3_600_000);
  const e = new Date(end.getTime() - 12 * 3_600_000);
  const months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + e.getUTCMonth() - s.getUTCMonth() + 1;
  const year = s.getUTCFullYear();
  if (months === 6 && (s.getUTCMonth() === 0 || s.getUTCMonth() === 6)) return `${s.getUTCMonth() === 0 ? 1 : 2}. Halbjahr ${year}`;
  if (months === 3 && s.getUTCMonth() % 3 === 0) return `${s.getUTCMonth() / 3 + 1}. Quartal ${year}`;
  if (months === 12 && s.getUTCMonth() === 0) return `${year}`;
  const fmt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
  return `${fmt.format(start)} bis ${fmt.format(end)}`;
}

export async function servicesWithProgress(db: PrismaClient, clientId: string, now: Date) {
  const services = await db.agreedService.findMany({ where: { clientId }, orderBy: { periodEnd: "asc" } });
  return Promise.all(
    services.map(async (service) => {
      const done = await doneCount(db, service);
      return {
        ...service,
        done,
        behind: isBehind(service, done, now),
        weeksLeft: weeksLeft(service.periodEnd, now),
        period: periodLabel(service.periodStart, service.periodEnd),
      };
    }),
  );
}
