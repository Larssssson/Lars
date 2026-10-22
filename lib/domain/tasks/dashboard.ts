import type { PrismaClient } from "@/lib/generated/prisma/client";
import { hasApprovalRight, type Actor, type PermissionContext } from "@/lib/domain/permissions";
import { dashboardGroup, OPEN_STATUSES, type DashboardGroup } from "./rules";
import { listTasks, type TaskRow } from "./queries";

/** Meine Aufgaben, gruppiert nach Dringend, Heute, Demnächst (BRIEFING 7.1). */
export async function myTasksGrouped(db: PrismaClient, userId: string, clientId: string | null, now: Date) {
  const tasks = await listTasks(db, { ownerId: userId, clientId }, now);
  const groups: Record<DashboardGroup, TaskRow[]> = { DRINGEND: [], HEUTE: [], DEMNAECHST: [] };
  for (const task of tasks) groups[dashboardGroup(task.priority)].push(task);
  return { groups, total: tasks.length };
}

/** Wartet auf meine Freigabe: offene Anfragen, in denen ich angefragt bin (BRIEFING 6.4, 7.1). */
export async function approvalsWaitingFor(
  db: PrismaClient,
  actor: Actor,
  ctx: PermissionContext,
  clientId: string | null,
) {
  const approvals = await db.approval.findMany({
    where: {
      decision: null,
      requestedApproverIds: { has: actor.id },
      document: { task: { status: "FREIGABE_ANGEFRAGT", clientId: clientId ?? undefined } },
    },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          documentFormat: { select: { name: true } },
          task: { select: { id: true, title: true, clientId: true, dueAt: true, client: { select: { name: true } }, owner: { select: { name: true } } } },
        },
      },
    },
    orderBy: { requestedAt: "asc" },
  });
  return approvals.filter((a) => hasApprovalRight(actor, ctx, a.document.task.clientId));
}

/** Kachel Redaktion: offene Dokumente pro Status (BRIEFING 7.1). */
export async function openDocumentsByStatus(db: PrismaClient, clientId: string | null) {
  const rows = await db.task.groupBy({
    by: ["status"],
    where: { type: "DOKUMENT", status: { in: OPEN_STATUSES }, clientId: clientId ?? undefined },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<(typeof OPEN_STATUSES)[number], number>>;
}

/**
 * Team-Ansicht für CVDs (BRIEFING 7.1): offene Aufgaben nach Person, überfällige Aufgaben,
 * Freigaben, die länger als 2 Stunden warten, offene Kontaktanfragen.
 */
export async function teamView(db: PrismaClient, clientId: string | null, now: Date) {
  const open = await listTasks(db, { clientId }, now);
  const byPerson = new Map<string, { name: string; tasks: TaskRow[] }>();
  for (const task of open) {
    const entry = byPerson.get(task.owner.id) ?? { name: task.owner.name, tasks: [] };
    entry.tasks.push(task);
    byPerson.set(task.owner.id, entry);
  }
  const overdue = open.filter((t) => t.dueAt.getTime() < now.getTime());
  const twoHoursAgo = new Date(now.getTime() - 2 * 3_600_000);
  const [longApprovals, openContactRequests] = await Promise.all([
    db.approval.findMany({
      where: {
        decision: null,
        requestedAt: { lte: twoHoursAgo },
        document: { task: { status: "FREIGABE_ANGEFRAGT", clientId: clientId ?? undefined } },
      },
      include: { document: { select: { title: true, task: { select: { id: true, client: { select: { name: true } }, owner: { select: { name: true } } } } } } },
      orderBy: { requestedAt: "asc" },
    }),
    db.contactRequest.count({ where: { status: "OFFEN", clientId: clientId ?? undefined } }),
  ]);
  return {
    byPerson: [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name, "de")),
    overdue,
    longApprovals,
    openContactRequests,
  };
}
