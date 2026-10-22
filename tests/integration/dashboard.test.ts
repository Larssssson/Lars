import { beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@/lib/db";
import { notifyClientWarnings } from "@/lib/domain/clients/service";
import { doneCount, isBehind } from "@/lib/domain/clients/services";
import { warningsFor } from "@/lib/domain/clients/warnings";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import { approvalsWaitingFor, myTasksGrouped, openDocumentsByStatus, teamView } from "@/lib/domain/tasks/dashboard";
import { atTime } from "@/lib/time";
import { clientByName, FIXED_NOW, resetAndSeed, testDeps, userByKey, usersByKey, type TestDeps } from "./helpers";

const db = createPrismaClient();
let deps: TestDeps;

beforeEach(async () => {
  await resetAndSeed(db);
  deps = await testDeps(db);
});

describe("Dashboard (BRIEFING 7.1)", () => {
  it("Meine Aufgaben nach Dringend, Heute, Demnächst, gefiltert nach Kunde", async () => {
    const laura = await userByKey(db, "laura");
    const robin = await userByKey(db, "robin");
    const mine = await myTasksGrouped(db, laura.id, null, FIXED_NOW);
    expect(mine.groups.DRINGEND.map((t) => t.title)).toEqual(["PM Standortentscheidung"]);
    expect(mine.total).toBe(1);
    const robinTasks = await myTasksGrouped(db, robin.id, null, FIXED_NOW);
    expect(robinTasks.groups.HEUTE.map((t) => t.title)).toEqual(["Q&A Standort aktualisieren"]);
    expect(robinTasks.groups.DEMNAECHST.map((t) => t.title)).toEqual(["Briefing für Gespräch im Ministerium"]);
    const rafael = await clientByName(db, "Rafael");
    expect((await myTasksGrouped(db, robin.id, rafael.id, FIXED_NOW)).total).toBe(1);
  });

  it("Wartet auf meine Freigabe: nur für angefragte Freigabeberechtigte", async () => {
    const [lars, laura] = await usersByKey(db, ["lars", "laura"]);
    const forLars = await approvalsWaitingFor(db, lars, await loadPermissionContext(db, lars.id), null);
    expect(forLars.map((a) => a.document.title)).toEqual(["PM Standortentscheidung"]);
    expect(await approvalsWaitingFor(db, laura, await loadPermissionContext(db, laura.id), null)).toEqual([]);
    const rafael = await clientByName(db, "Rafael");
    expect(await approvalsWaitingFor(db, lars, await loadPermissionContext(db, lars.id), rafael.id)).toEqual([]);
  });

  it("Kachel Redaktion zählt offene Dokumente pro Status", async () => {
    const counts = await openDocumentsByStatus(db, null);
    expect(counts).toMatchObject({ IN_BEARBEITUNG: 4, FREIGABE_ANGEFRAGT: 1, AENDERUNGEN_ANGEFORDERT: 1, FREIGEGEBEN: 1, BEIM_KUNDEN: 1, OFFEN: 1 });
  });

  it("Team-Ansicht: Aufgaben nach Person, überfällig, Freigaben über 2 Stunden", async () => {
    const view = await teamView(db, null, FIXED_NOW);
    expect(view.byPerson.map((p) => p.name)).toContain("Lukas");
    expect(view.overdue).toHaveLength(0);
    expect(view.longApprovals).toHaveLength(0);
    const later = atTime("2026-10-20", "13:00");
    const laterView = await teamView(db, null, later);
    expect(laterView.overdue.map((t) => t.title)).toEqual(["PM Standortentscheidung"]);
    expect(laterView.longApprovals).toHaveLength(1);
    expect(laterView.openContactRequests).toBe(0);
  });
});

describe("Warnungen (BRIEFING 7.1, 7.7, 13.1)", () => {
  it("zeigt Profil-, Compliance- und Leistungswarnungen für CVDs", async () => {
    const lars = await userByKey(db, "lars");
    const warnings = await warningsFor(db, lars, await loadPermissionContext(db, lars.id), null, FIXED_NOW);
    const by = (client: string) => warnings.filter((w) => w.clientName === client).map((w) => w.kind).sort();
    expect(by("Rafael")).toEqual(["PROFILE_STALE"]);
    expect(by("Ground A")).toEqual(["COMPLIANCE_STALE", "PROFILE_STALE"]);
    expect(by("Covenant")).toEqual(["SERVICE_BEHIND", "SERVICE_BEHIND"]);
    expect(warnings.find((w) => w.kind === "COMPLIANCE_STALE")?.text).toBe("Compliance-Regeln sind 13 Monate alt");
    expect(warnings.find((w) => w.text.startsWith("Journalisten-Roundtable"))?.text).toBe(
      "Journalisten-Roundtable: 0 von 1 im 2. Halbjahr 2026, noch 10 Wochen",
    );
  });

  it("Redakteure ohne Lead-Rolle sehen keine Warnungen", async () => {
    const laura = await userByKey(db, "laura");
    expect(await warningsFor(db, laura, await loadPermissionContext(db, laura.id), null, FIXED_NOW)).toEqual([]);
  });

  it("Rückstand: weniger als die Hälfte nach der Hälfte, oder Ende in 30 Tagen", async () => {
    const service = await db.agreedService.findFirstOrThrow({ where: { title: "Pressemitteilungen" } });
    expect(await doneCount(db, service)).toBe(1);
    expect(isBehind(service, 1, FIXED_NOW)).toBe(true);
    expect(isBehind(service, 3, FIXED_NOW)).toBe(false);
    expect(isBehind(service, 5, atTime("2026-12-10", "10:00"))).toBe(true);
    const q4 = await db.agreedService.findFirstOrThrow({ where: { title: "Medien-Pitches" } });
    expect(isBehind(q4, 0, FIXED_NOW)).toBe(false);
  });

  it("der tägliche Job schreibt Warnungen in die Glocke von Lead und CVDs, ohne Push und ohne Dubletten", async () => {
    const [lars, lukas, laura] = await usersByKey(db, ["lars", "lukas", "laura"]);
    const created = await notifyClientWarnings(deps);
    expect(created).toBeGreaterThan(0);
    expect(await db.notification.count({ where: { userId: lars.id, kind: "PROFILE_WARNING" } })).toBe(3);
    expect(await db.notification.count({ where: { userId: lukas.id, kind: "SERVICE_BACKLOG" } })).toBe(2);
    expect(await db.notification.count({ where: { userId: laura.id } })).toBe(0);
    expect(await db.notification.count({ where: { isPush: true } })).toBe(0);
    expect(await notifyClientWarnings(deps)).toBe(0);
  });
});

describe("Leistung (BRIEFING 10.6)", () => {
  it("Dashboard-Abfragen bei 500 offenen Aufgaben deutlich unter 1,5 Sekunden", async () => {
    const [laura, lars] = await usersByKey(db, ["laura", "lars"]);
    const covenant = await clientByName(db, "Covenant");
    await db.task.createMany({
      data: Array.from({ length: 500 }, (_, i) => ({
        clientId: covenant.id,
        title: `Last ${i}`,
        category: "MEDIENARBEIT" as const,
        type: "AUFGABE" as const,
        ownerId: i % 2 ? laura.id : lars.id,
        dueAt: new Date(FIXED_NOW.getTime() + (i - 50) * 3_600_000),
        isSampleData: true,
      })),
    });
    const ctx = await loadPermissionContext(db, lars.id);
    const start = performance.now();
    await Promise.all([
      myTasksGrouped(db, laura.id, null, FIXED_NOW),
      approvalsWaitingFor(db, lars, ctx, null),
      openDocumentsByStatus(db, null),
      warningsFor(db, lars, ctx, null, FIXED_NOW),
      teamView(db, null, FIXED_NOW),
    ]);
    expect(performance.now() - start).toBeLessThan(1500);
  });
});
