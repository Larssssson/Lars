import { buildFilledContent, buildTemplateContent, parseBlocks } from "../lib/domain/documents/template";
import { computePriority } from "../lib/domain/tasks/rules";
import type { PrismaClient, TaskStatus } from "../lib/generated/prisma/client";
import { addDays, addWorkdays, atTime, berlinParts, dateKey, isWorkday, mondayOf } from "../lib/time";
import {
  seedClients,
  seededProfileSections,
  seedFormats,
  seedProfileAges,
  seedServices,
  seedShiftRotation,
  seedShiftTypes,
  seedTasks,
  seedUsers,
  type SeedDue,
  type SeedUserKey,
} from "./seed-data";

const DAY = 86_400_000;

function resolveDue(due: SeedDue, now: Date): Date {
  const today = dateKey(now);
  const p = berlinParts(now);
  const time = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  if ("minutes" in due) return new Date(now.getTime() + due.minutes * 60_000);
  if ("days" in due) return new Date(now.getTime() + due.days * DAY);
  if ("workdays" in due) return atTime(addWorkdays(today, due.workdays), time);
  if ("todayAt" in due) return atTime(today, due.todayAt);
  return atTime(addDays(today, 1), due.tomorrowAt);
}

/** Kalendertag als Wert für Date-Spalten. */
function dateColumn(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/**
 * Seed nach BRIEFING 13. Idempotent: mehrfaches Ausführen ändert nichts.
 * Nutzer und Konfiguration sind keine Beispieldaten, alles andere trägt isSampleData = true.
 * Jede Phase ergänzt hier die Daten, die sie nutzt (DECISIONS D-031).
 */
export async function seed(db: PrismaClient, now: Date = new Date()): Promise<void> {
  const userIds = {} as Record<SeedUserKey, string>;
  for (const u of seedUsers) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, role: u.role, isAdmin: u.isAdmin },
    });
    userIds[u.key] = user.id;
  }

  for (const c of seedClients) {
    const client = await db.client.upsert({
      where: { shortName: c.shortName },
      update: {},
      create: {
        name: c.name,
        shortName: c.shortName,
        industry: c.industry,
        cluster: c.cluster,
        status: c.status,
        isSampleData: true,
      },
    });
    const members = [
      { userId: userIds[c.lead], kind: "LEAD" as const, canApprove: c.leadCanApprove },
      ...c.team.map((key) => ({ userId: userIds[key], kind: "TEAM" as const, canApprove: false })),
    ];
    for (const m of members) {
      await db.clientMember.upsert({
        where: { clientId_userId: { clientId: client.id, userId: m.userId } },
        update: {},
        create: { clientId: client.id, ...m, isSampleData: true },
      });
    }
  }

  for (const s of seedShiftTypes) {
    await db.shiftType.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  for (const [index, f] of seedFormats.entries()) {
    await db.documentFormat.upsert({
      where: { key: f.key },
      update: {},
      create: { ...f, builtIn: true, sortOrder: index + 1 },
    });
  }

  await seedPhase1(db, now, userIds);
}

/** Phase 1: Leistungen, Profil-Bestätigungsdaten, Aufgaben (13.5) und Dienstplan (13.6). */
async function seedPhase1(db: PrismaClient, now: Date, userIds: Record<SeedUserKey, string>): Promise<void> {
  const clients = Object.fromEntries((await db.client.findMany()).map((c) => [c.name, c]));
  const sample = { isSampleData: true };

  const serviceIds: Record<string, string> = {};
  for (const s of seedServices) {
    const client = clients[s.client];
    if (!client) continue;
    const existing = await db.agreedService.findFirst({ where: { clientId: client.id, title: s.title } });
    const service =
      existing ??
      (await db.agreedService.create({
        data: {
          clientId: client.id,
          title: s.title,
          category: s.category,
          targetCount: s.targetCount,
          periodStart: atTime(s.from, "00:00"),
          periodEnd: atTime(s.to, "23:59"),
          ...sample,
        },
      }));
    serviceIds[s.key] = service.id;
  }

  for (const [clientName, ages] of Object.entries(seedProfileAges)) {
    const client = clients[clientName];
    if (!client) continue;
    for (const key of seededProfileSections) {
      const age = ages.overrides?.[key] ?? ages.default;
      await db.clientProfileSection.upsert({
        where: { clientId_key: { clientId: client.id, key } },
        update: {},
        create: { clientId: client.id, key, confirmedAt: new Date(now.getTime() - age * DAY), confirmedBy: userIds.lars, ...sample },
      });
    }
  }

  const formats = Object.fromEntries((await db.documentFormat.findMany()).map((f) => [f.key, f]));
  const projectIds: Record<string, string> = {};
  for (const task of seedTasks) {
    const client = clients[task.client];
    if (!client) continue;
    if (await db.task.findFirst({ where: { clientId: client.id, title: task.title } })) continue;

    let projectId: string | null = null;
    if (task.project) {
      projectId = projectIds[task.project] ?? null;
      if (!projectId) {
        const project =
          (await db.project.findFirst({ where: { clientId: client.id, title: task.project } })) ??
          (await db.project.create({
            data: {
              clientId: client.id,
              title: task.project,
              kind: "ROUNDTABLE",
              status: "LAUFEND",
              startDate: now,
              endDate: new Date(now.getTime() + 10 * DAY),
              agreedServiceId: serviceIds.cov_roundtable ?? null,
              createdBy: userIds.lukas,
              ...sample,
            },
          }));
        projectId = project.id;
        projectIds[task.project] = project.id;
      }
    }

    const dueAt = resolveDue(task.due, now);
    const status = task.status as TaskStatus;
    const ownerId = userIds[task.owner];
    const completedAt = status === "ERLEDIGT" ? dueAt : null;
    const created = await db.task.create({
      data: {
        clientId: client.id,
        projectId,
        agreedServiceId: task.service ? serviceIds[task.service] ?? null : null,
        title: task.title,
        category: task.category,
        type: task.format ? "DOKUMENT" : "AUFGABE",
        ownerId,
        dueAt,
        priority: computePriority(dueAt, null, now),
        status,
        completedAt,
        createdBy: ownerId,
        createdAt: status === "ERLEDIGT" ? new Date(dueAt.getTime() - 5 * DAY) : new Date(now.getTime() - DAY),
        ...sample,
      },
    });
    if (!task.format) continue;

    const format = formats[task.format];
    if (!format) continue;
    const blocks = parseBlocks(format.blocks);
    const content = task.texts ? buildFilledContent(blocks, task.texts) : buildTemplateContent(blocks);
    const document = await db.document.create({
      data: { taskId: created.id, format: format.key, title: task.title, content, createdBy: ownerId, ...sample },
    });
    if (["OFFEN", "IN_BEARBEITUNG"].includes(status)) continue;

    // Dokumente jenseits der Bearbeitung haben eine Version und eine Freigabeanfrage (BRIEFING 6.4)
    const version = await db.documentVersion.create({
      data: { documentId: document.id, number: 1, content, reason: "STATUSWECHSEL", createdBy: ownerId, ...sample },
    });
    await db.document.update({ where: { id: document.id }, data: { currentVersionId: version.id } });
    const approvers = [userIds.lars, userIds.lukas];
    const requestedAt = status === "FREIGABE_ANGEFRAGT" ? new Date(now.getTime() - 40 * 60_000) : new Date(now.getTime() - DAY);
    const decision = status === "FREIGABE_ANGEFRAGT" ? null : status === "AENDERUNGEN_ANGEFORDERT" ? "AENDERUNGEN" : "FREIGEGEBEN";
    const decidedBy = task.approver ? userIds[task.approver] : null;
    await db.approval.create({
      data: {
        documentId: document.id,
        versionId: version.id,
        requestedBy: ownerId,
        requestedAt,
        requestedApproverIds: approvers,
        decision,
        decidedBy: decision ? decidedBy : null,
        decidedAt: decision ? new Date(requestedAt.getTime() + 2 * 3_600_000) : null,
        claimedBy: decision ? decidedBy : null,
        claimedAt: decision ? new Date(requestedAt.getTime() + 30 * 60_000) : null,
        note: decision === "AENDERUNGEN" ? "[Beispiel] Bitte den Förderbetrag prüfen und das Zitat kürzen." : null,
        createdBy: ownerId,
        ...sample,
      },
    });
    if (status === "BEIM_KUNDEN" || status === "ERLEDIGT") {
      await db.dispatch.create({
        data: {
          documentId: document.id,
          versionId: version.id,
          target: status === "BEIM_KUNDEN" ? "KUNDE_ABSTIMMUNG" : "MEDIEN",
          recipients: status === "BEIM_KUNDEN" ? "[Beispiel] Kommunikation Rafael" : "[Beispiel] Verteiler Leitmedien",
          channel: "Mail",
          sentAt: status === "ERLEDIGT" ? dueAt : new Date(now.getTime() - 3 * 3_600_000),
          sentBy: ownerId,
          createdBy: ownerId,
          ...sample,
        },
      });
    }
  }

  // Dienstplan für die laufende und die nächste Woche (BRIEFING 13.6)
  const types = Object.fromEntries((await db.shiftType.findMany()).map((t) => [t.key, t]));
  const monday = mondayOf(dateKey(now));
  let workdayIndex = 0;
  for (let i = 0; i < 14; i++) {
    const day = addDays(monday, i);
    if (!isWorkday(day)) continue;
    const plan: [string, SeedUserKey][] = [
      ["CVD_VOM_DIENST", seedShiftRotation.cvd[workdayIndex % seedShiftRotation.cvd.length]!],
      ["PRESSESPIEGEL", seedShiftRotation.pressespiegel[workdayIndex % seedShiftRotation.pressespiegel.length]!],
    ];
    workdayIndex += 1;
    for (const [typeKey, userKey] of plan) {
      const type = types[typeKey];
      if (!type) continue;
      const userId = userIds[userKey];
      const date = dateColumn(day);
      const start = atTime(day, type.defaultStart);
      const end = atTime(day, type.defaultEnd);
      await db.shift.upsert({
        where: { shiftTypeId_date_userId: { shiftTypeId: type.id, date, userId } },
        update: {},
        create: { shiftTypeId: type.id, userId, date, start, end, ...sample },
      });
    }
  }
}

async function main() {
  const { createPrismaClient } = await import("../lib/db");
  const db = createPrismaClient();
  try {
    await seed(db);
    console.info("Seed abgeschlossen.");
  } finally {
    await db.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await import("dotenv/config");
  await main();
}
