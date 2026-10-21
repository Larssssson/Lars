import type { Prisma, PrismaClient, Priority, TaskStatus } from "@/lib/generated/prisma/client";
import { compareTasks, computePriority, OPEN_STATUSES } from "./rules";

const taskInclude = {
  client: { select: { id: true, name: true, shortName: true } },
  owner: { select: { id: true, name: true } },
  project: { select: { id: true, title: true } },
  document: { select: { id: true, format: true, documentFormat: { select: { name: true } } } },
} satisfies Prisma.TaskInclude;

export type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

/** Priorität beim Lesen berechnen (DECISIONS D-013) und sortieren (BRIEFING 6.2). */
function withLivePriority<T extends { dueAt: Date; priorityManual: "DRINGEND" | null; priority: Priority; createdAt: Date }>(
  rows: T[],
  now: Date,
): T[] {
  return rows.map((r) => ({ ...r, priority: computePriority(r.dueAt, r.priorityManual, now) })).sort(compareTasks);
}

/** Statusauswahl der Redaktion: "OFFEN_ALLE" (Standard), "ALLE" oder ein einzelner Status. */
export type StatusFilter = "OFFEN_ALLE" | "ALLE" | TaskStatus;

export type TaskFilter = {
  clientId?: string | null;
  projectId?: string | null;
  ownerId?: string | null;
  status?: StatusFilter;
  /** Darstellungsform; "AUFGABE" steht für einfache Aufgaben */
  format?: string | null;
  priority?: Priority | null;
  dueFrom?: Date | null;
  dueTo?: Date | null;
};

/** Redaktion: alle Aufgaben mit Filtern (BRIEFING 7.2). Archivierte nur bei ausdrücklichem Filter. */
export async function listTasks(db: PrismaClient, filter: TaskFilter, now: Date): Promise<TaskRow[]> {
  const status = filter.status ?? "OFFEN_ALLE";
  const where: Prisma.TaskWhereInput = {
    // Aufgaben von "RP intern" gehören zu keinem Kunden und bleiben bei jeder Kundenauswahl sichtbar (DECISIONS D-101)
    ...(filter.clientId ? { OR: [{ clientId: filter.clientId }, { client: { isInternal: true } }] } : {}),
    projectId: filter.projectId ?? undefined,
    ownerId: filter.ownerId ?? undefined,
    status:
      status === "OFFEN_ALLE" ? { in: OPEN_STATUSES } : status === "ALLE" ? { not: "ARCHIVIERT" } : status,
    dueAt: filter.dueFrom || filter.dueTo ? { gte: filter.dueFrom ?? undefined, lte: filter.dueTo ?? undefined } : undefined,
    ...(filter.format === "AUFGABE"
      ? { type: "AUFGABE" }
      : filter.format
        ? { document: { format: filter.format } }
        : {}),
  };
  const rows = await db.task.findMany({ where, include: taskInclude });
  const sorted = withLivePriority(rows, now);
  return filter.priority ? sorted.filter((r) => r.priority === filter.priority) : sorted;
}

export function getTask(db: PrismaClient, id: string) {
  return db.task.findUnique({
    where: { id },
    include: {
      ...taskInclude,
      agreedService: { select: { id: true, title: true } },
      preferredApprover: { select: { id: true, name: true } },
      attachments: { select: { id: true, name: true, size: true } },
    },
  });
}

/**
 * Suche über Aufgaben, Dokumente (Titel und Text), Kunden und Kontakte (DECISIONS D-022). Kontakte
 * nur über Name und Medium, nie über Kontaktdaten.
 */
export async function search(db: PrismaClient, query: string) {
  const q = query.trim();
  if (q.length < 2) return { tasks: [], clients: [], contacts: [] };
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const inDocuments = await db.$queryRaw<{ taskId: string }[]>`
    SELECT "taskId" FROM "Document" WHERE "title" ILIKE ${pattern} OR "content"::text ILIKE ${pattern} LIMIT 100`;
  const words = q.split(/\s+/).filter(Boolean);
  const [tasks, clients, contacts] = await Promise.all([
    db.task.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { id: { in: inDocuments.map((d) => d.taskId) } },
        ],
      },
      include: taskInclude,
      orderBy: { dueAt: "desc" },
      take: 50,
    }),
    db.client.findMany({
      where: { isInternal: false, OR: [{ name: { contains: q, mode: "insensitive" } }, { shortName: { contains: q, mode: "insensitive" } }] },
      orderBy: { name: "asc" },
      take: 20,
    }),
    db.journalist.findMany({
      where: {
        AND: words.map((w) => ({
          OR: [
            { firstName: { contains: w, mode: "insensitive" as const } },
            { lastName: { contains: w, mode: "insensitive" as const } },
            { media: { name: { contains: w, mode: "insensitive" as const } } },
          ],
        })),
      },
      select: { id: true, firstName: true, lastName: true, media: { select: { name: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 30,
    }),
  ]);
  return { tasks, clients, contacts };
}
