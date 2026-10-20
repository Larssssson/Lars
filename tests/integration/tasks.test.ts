import { beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@/lib/db";
import { DomainError } from "@/lib/domain/errors";
import { ForbiddenError } from "@/lib/domain/permissions";
import { listTasks } from "@/lib/domain/tasks/queries";
import {
  archiveCompletedTasks,
  createTask,
  recalculatePriorities,
  setManualUrgent,
  setSimpleTaskStatus,
  updateTask,
} from "@/lib/domain/tasks/service";
import { atTime } from "@/lib/time";
import { clientByName, clientsByName, FIXED_NOW, resetAndSeed, testDeps, userByKey, usersByKey, type TestDeps } from "./helpers";

const db = createPrismaClient();
let deps: TestDeps;

beforeEach(async () => {
  await resetAndSeed(db);
  deps = await testDeps(db);
});

const inHours = (h: number) => new Date(FIXED_NOW.getTime() + h * 3_600_000);

describe("Beispielaufgaben aus BRIEFING 13.5", () => {
  it("enthalten jede Priorität und alle Status", async () => {
    const tasks = await db.task.findMany();
    expect(tasks).toHaveLength(12);
    expect(new Set(tasks.filter((t) => t.status !== "ERLEDIGT").map((t) => t.priority))).toEqual(
      new Set(["DRINGEND", "HOCH", "NORMAL", "NIEDRIG"]),
    );
    expect(new Set(tasks.map((t) => t.status))).toEqual(
      new Set(["OFFEN", "IN_BEARBEITUNG", "FREIGABE_ANGEFRAGT", "AENDERUNGEN_ANGEFORDERT", "FREIGEGEBEN", "BEIM_KUNDEN", "ERLEDIGT"]),
    );
    expect(tasks.every((t) => t.isSampleData)).toBe(true);
  });

  it("legen Dokumente, Versionen, Freigaben und Projekt an", async () => {
    const pm = await db.task.findFirstOrThrow({ where: { title: "PM Standortentscheidung" }, include: { document: { include: { approvals: true } } } });
    expect(pm.document?.format).toBe("PRESSEMITTEILUNG");
    expect(pm.document?.approvals[0]?.decision).toBeNull();
    expect(pm.document?.approvals[0]?.requestedApproverIds).toHaveLength(2);
    const project = await db.project.findFirstOrThrow({ where: { title: "Roundtable Herbst" }, include: { tasks: true } });
    expect(project.tasks.map((t) => t.title).sort()).toEqual([
      "Roundtable Herbst: Agenda", "Roundtable Herbst: Einladung", "Roundtable Herbst: Konzept",
    ]);
  });
});

describe("Aufgaben anlegen (BRIEFING 6.1)", () => {
  it("legt eine eigene einfache Aufgabe an", async () => {
    const laura = await userByKey(db, "laura");
    const covenant = await clientByName(db, "Covenant");
    const task = await createTask(deps, laura, {
      clientId: covenant.id, category: "MEDIENARBEIT", type: "AUFGABE", title: "Journalistin anrufen", ownerId: laura.id, dueAt: inHours(30),
    });
    expect(task.status).toBe("OFFEN");
    expect(task.priority).toBe("NORMAL");
    expect(await db.notification.count({ where: { userId: laura.id } })).toBe(0);
  });

  it("erzeugt bei Dokument-Aufgaben ein leeres Dokument aus der Vorlage", async () => {
    const laura = await userByKey(db, "laura");
    const covenant = await clientByName(db, "Covenant");
    const task = await createTask(deps, laura, {
      clientId: covenant.id, category: "MEDIENARBEIT", type: "DOKUMENT", format: "STATEMENT", title: "Statement Standort", ownerId: laura.id, dueAt: inHours(30),
    });
    const doc = await db.document.findUniqueOrThrow({ where: { taskId: task.id } });
    const content = doc.content as { content: { attrs: { key: string } }[] };
    expect(content.content.map((b) => b.attrs.key)).toEqual(["sprecher", "anlass", "text"]);
  });

  it("verlangt für Dokumente eine Darstellungsform", async () => {
    const laura = await userByKey(db, "laura");
    const covenant = await clientByName(db, "Covenant");
    await expect(
      createTask(deps, laura, { clientId: covenant.id, category: "MEDIENARBEIT", type: "DOKUMENT", title: "x", ownerId: laura.id, dueAt: inHours(30) }),
    ).rejects.toThrow();
  });

  it("Aufgaben für andere nur mit Recht; Zuweisung erscheint in der Glocke, Push nur wenn dringend", async () => {
    const [laura, robin, valentin, juliana, lars, mika] = await usersByKey(db, ["laura", "robin", "valentin", "juliana", "lars", "mika"]);
    const [covenant, safenet, groundA] = await clientsByName(db, ["Covenant", "SAFENET", "Ground A"]);
    const base = { category: "MEDIENARBEIT" as const, type: "AUFGABE" as const, title: "Rückruf" };

    await expect(createTask(deps, laura, { ...base, clientId: covenant.id, ownerId: robin.id, dueAt: inHours(30) })).rejects.toThrow(ForbiddenError);
    // Kunden-Lead für seinen Kunden ja, für andere nein
    await createTask(deps, valentin, { ...base, clientId: safenet.id, ownerId: juliana.id, dueAt: inHours(30) });
    await expect(createTask(deps, valentin, { ...base, clientId: covenant.id, ownerId: juliana.id, dueAt: inHours(30) })).rejects.toThrow(ForbiddenError);
    expect(await db.notification.count({ where: { userId: juliana.id, kind: "TASK_ASSIGNED", isPush: false } })).toBe(1);
    expect(deps.push.sent).toHaveLength(0);

    await createTask(deps, lars, { ...base, clientId: groundA.id, ownerId: mika.id, dueAt: inHours(1) });
    const urgent = await db.notification.findFirstOrThrow({ where: { userId: mika.id } });
    expect(urgent.isPush).toBe(true);
    expect(deps.push.sent).toHaveLength(1);
    expect(deps.push.sent[0]?.body).toContain("Ground A");
  });

  it("prüft Projekt, Leistung und bevorzugten Freigeber gegen den Kunden", async () => {
    const [laura, robin, lukas] = await usersByKey(db, ["laura", "robin", "lukas"]);
    const [covenant, rafael] = await clientsByName(db, ["Covenant", "Rafael"]);
    const base = { clientId: covenant.id, category: "MEDIENARBEIT" as const, type: "AUFGABE" as const, title: "x", ownerId: laura.id, dueAt: inHours(30) };
    await expect(createTask(deps, laura, { ...base, preferredApproverId: robin.id })).rejects.toThrow(DomainError);
    const rafaelService = await db.agreedService.findFirstOrThrow({ where: { clientId: rafael.id } });
    await expect(createTask(deps, laura, { ...base, agreedServiceId: rafaelService.id })).rejects.toThrow(DomainError);
    const ok = await createTask(deps, laura, { ...base, preferredApproverId: lukas.id });
    expect(ok.preferredApproverId).toBe(lukas.id);
  });

  it("speichert Anhänge über den Dateispeicher", async () => {
    const laura = await userByKey(db, "laura");
    const covenant = await clientByName(db, "Covenant");
    const task = await createTask(
      deps, laura,
      { clientId: covenant.id, category: "INTERN", type: "AUFGABE", title: "Mit Anhang", ownerId: laura.id, dueAt: inHours(30) },
      [{ name: "notiz.txt", mimeType: "text/plain", data: new TextEncoder().encode("Inhalt") }],
    );
    const file = await db.file.findFirstOrThrow({ where: { taskId: task.id } });
    expect(new TextDecoder().decode(await deps.files.get(file.storageKey))).toBe("Inhalt");
  });
});

describe("Priorität (BRIEFING 6.2)", () => {
  it("nur CVDs stufen hoch; der Owner wird benachrichtigt, die Markierung lässt sich entfernen", async () => {
    const [laura, lars, mika] = await usersByKey(db, ["laura", "lars", "mika"]);
    const task = await db.task.findFirstOrThrow({ where: { title: "LinkedIn-Beitrag Messe" } });
    await expect(setManualUrgent(deps, laura, task.id, true)).rejects.toThrow(ForbiddenError);
    const marked = await setManualUrgent(deps, lars, task.id, true);
    expect(marked.priority).toBe("DRINGEND");
    expect(await db.notification.findFirst({ where: { userId: mika.id, kind: "TASK_URGENT", isPush: true } })).not.toBeNull();
    const unmarked = await setManualUrgent(deps, lars, task.id, false);
    expect(unmarked.priority).toBe("NORMAL");
  });

  it("der 5-Minuten-Job stuft hoch und benachrichtigt genau einmal", async () => {
    const robin = await userByKey(db, "robin");
    expect(await recalculatePriorities(deps)).toEqual({ changed: 0, becameUrgent: 0 });
    deps.clock.now = atTime("2026-10-20", "15:30"); // Q&A heute 17 Uhr ist jetzt dringend
    const first = await recalculatePriorities(deps);
    expect(first.becameUrgent).toBeGreaterThanOrEqual(1);
    expect(await db.notification.count({ where: { userId: robin.id, kind: "TASK_URGENT" } })).toBe(1);
    expect((await recalculatePriorities(deps)).becameUrgent).toBe(0);
    expect(await db.notification.count({ where: { userId: robin.id, kind: "TASK_URGENT" } })).toBe(1);
  });

  it("Änderung der Frist berechnet die Priorität neu", async () => {
    const [lars, juliana] = await usersByKey(db, ["lars", "juliana"]);
    const task = await db.task.findFirstOrThrow({ where: { title: "Hintergrundgespräch Hauptstadt Kurier" } });
    const updated = await updateTask(deps, lars, task.id, { title: task.title, dueAt: inHours(1), ownerId: juliana.id });
    expect(updated.priority).toBe("DRINGEND");
    expect(await db.notification.count({ where: { userId: juliana.id, kind: "TASK_URGENT" } })).toBe(1);
  });
});

describe("Status einfacher Aufgaben (BRIEFING 6.3)", () => {
  it("durchläuft Offen, In Bearbeitung, Erledigt und wird nach 30 Tagen archiviert", async () => {
    const juliana = await userByKey(db, "juliana");
    const task = await db.task.findFirstOrThrow({ where: { title: "Hintergrundgespräch Hauptstadt Kurier" } });
    await setSimpleTaskStatus(deps, juliana, task.id, "IN_BEARBEITUNG");
    const done = await setSimpleTaskStatus(deps, juliana, task.id, "ERLEDIGT");
    expect(done.completedAt).toEqual(FIXED_NOW);
    await expect(setSimpleTaskStatus(deps, juliana, task.id, "OFFEN")).rejects.toThrow(DomainError);

    deps.clock.now = new Date(FIXED_NOW.getTime() + 29 * 86_400_000);
    // archiviert nur die seit 20 Tagen erledigte PM Spatenstich aus dem Seed
    expect(await archiveCompletedTasks(deps)).toBe(1);
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("ERLEDIGT");
    deps.clock.now = new Date(FIXED_NOW.getTime() + 31 * 86_400_000);
    expect(await archiveCompletedTasks(deps)).toBe(1);
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("ARCHIVIERT");
  });

  it("nur Owner, Kunden-Lead und CVD ändern den Status; Dokumente nicht hier", async () => {
    const [mika, lars, laura] = await usersByKey(db, ["mika", "lars", "laura"]);
    const task = await db.task.findFirstOrThrow({ where: { title: "Hintergrundgespräch Hauptstadt Kurier" } });
    await expect(setSimpleTaskStatus(deps, mika, task.id, "IN_BEARBEITUNG")).rejects.toThrow(ForbiddenError);
    await setSimpleTaskStatus(deps, lars, task.id, "IN_BEARBEITUNG");
    const pm = await db.task.findFirstOrThrow({ where: { title: "PM Standortentscheidung" } });
    await expect(setSimpleTaskStatus(deps, laura, pm.id, "ERLEDIGT")).rejects.toThrow(DomainError);
  });
});

describe("Redaktion: Liste mit allen Filtern (BRIEFING 7.2)", () => {
  it("zeigt standardmäßig alle offenen Aufgaben sortiert nach Priorität, Frist, Anlage", async () => {
    const tasks = await listTasks(db, {}, FIXED_NOW);
    expect(tasks).toHaveLength(11);
    expect(tasks[0]?.title).toBe("PM Standortentscheidung");
    const ranks = tasks.map((t) => ["DRINGEND", "HOCH", "NORMAL", "NIEDRIG"].indexOf(t.priority));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("filtert nach Kunde, Projekt, Owner, Status, Darstellungsform, Priorität und Zeitraum", async () => {
    const [covenant, juliana] = await Promise.all([clientByName(db, "Covenant"), userByKey(db, "juliana")]);
    const project = await db.project.findFirstOrThrow();
    expect((await listTasks(db, { clientId: covenant.id }, FIXED_NOW)).every((t) => t.client.id === covenant.id)).toBe(true);
    expect(await listTasks(db, { projectId: project.id }, FIXED_NOW)).toHaveLength(3);
    expect((await listTasks(db, { ownerId: juliana.id }, FIXED_NOW)).map((t) => t.title).sort()).toEqual([
      "Hintergrundgespräch Hauptstadt Kurier", "Statement zur Förderung",
    ]);
    expect(await listTasks(db, { status: "ERLEDIGT" }, FIXED_NOW)).toHaveLength(1);
    expect(await listTasks(db, { status: "ALLE" }, FIXED_NOW)).toHaveLength(12);
    expect((await listTasks(db, { format: "AUFGABE" }, FIXED_NOW)).every((t) => t.type === "AUFGABE")).toBe(true);
    expect(await listTasks(db, { format: "PRESSEMITTEILUNG" }, FIXED_NOW)).toHaveLength(1);
    expect((await listTasks(db, { priority: "HOCH" }, FIXED_NOW)).map((t) => t.title).sort()).toEqual([
      "Pitch Luftverteidigung", "Q&A Standort aktualisieren",
    ]);
    const today = await listTasks(db, { dueFrom: atTime("2026-10-20", "00:00"), dueTo: atTime("2026-10-20", "23:59") }, FIXED_NOW);
    expect(today.map((t) => t.title).sort()).toEqual(["PM Standortentscheidung", "Pitch Luftverteidigung", "Q&A Standort aktualisieren"]);
  });
});
