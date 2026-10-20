import { readdir } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  CheckConfirmationRequired,
  claimApproval,
  decideApproval,
  reopenForEditing,
  requestApproval,
  withdrawApproval,
} from "@/lib/domain/approvals/service";
import { createClient } from "@/lib/domain/clients/service";
import { doneCount } from "@/lib/domain/clients/services";
import { clientAgreed, exportDocument, recordDispatch } from "@/lib/domain/documents/dispatch";
import {
  addComment,
  importWord,
  LOCK_TIMEOUT_MS,
  openForEditing,
  releaseLock,
  requestLock,
  resolveThread,
  saveContent,
  saveManualVersion,
} from "@/lib/domain/documents/service";
import { buildFilledContent, parseBlocks } from "@/lib/domain/documents/template";
import { buildDocx } from "@/lib/domain/documents/word-export";
import { DomainError } from "@/lib/domain/errors";
import { ForbiddenError } from "@/lib/domain/permissions";
import { createProject, setProjectStatus } from "@/lib/domain/tasks/projects";
import { createTask } from "@/lib/domain/tasks/service";
import { blockTexts, type JSONNode } from "@/lib/editor/content";
import { createPrismaClient } from "@/lib/db";
import { FIXED_NOW, resetAndSeed, testDeps, usersByKey, clientByName, type TestDeps } from "./helpers";

const db = createPrismaClient();
let deps: TestDeps;

beforeEach(async () => {
  await resetAndSeed(db);
  deps = await testDeps(db);
});

const later = (minutes: number) => new Date(FIXED_NOW.getTime() + minutes * 60_000);

async function newPm(owner: Awaited<ReturnType<typeof usersByKey>>[0]) {
  const covenant = await clientByName(db, "Covenant");
  return createTask(deps, owner, {
    clientId: covenant.id, category: "MEDIENARBEIT", type: "DOKUMENT", format: "PRESSEMITTEILUNG", title: "Standort Sachsen", ownerId: owner.id, dueAt: later(60 * 30),
  });
}

async function contentWith(taskId: string, texts: Record<string, string>): Promise<JSONNode> {
  const doc = await db.document.findUniqueOrThrow({ where: { taskId }, include: { documentFormat: true } });
  return buildFilledContent(parseBlocks(doc.documentFormat.blocks), texts) as JSONNode;
}

describe("Bearbeitungssperre (BRIEFING 7.3)", () => {
  it("wer schreibt, sperrt; andere lesen mit, fordern an und übernehmen nach 10 Minuten", async () => {
    const [laura, lukas] = await usersByKey(db, ["laura", "lukas"]);
    const task = await newPm(laura);
    expect(await openForEditing(deps, laura, task.id)).toEqual({ editing: true, holderId: laura.id, holderName: "Laura" });
    expect(await openForEditing(deps, lukas, task.id)).toEqual({ editing: false, holderId: laura.id, holderName: "Laura" });
    await expect(saveContent(deps, lukas, task.id, await contentWith(task.id, { headline: "x" }))).rejects.toThrow(DomainError);

    await requestLock(deps, lukas, task.id);
    expect(await db.notification.count({ where: { userId: laura.id, kind: "LOCK_REQUESTED" } })).toBe(1);

    deps.clock.now = new Date(FIXED_NOW.getTime() + LOCK_TIMEOUT_MS + 1000);
    expect((await openForEditing(deps, lukas, task.id)).editing).toBe(true);
  });

  it("Speichern setzt Offen auf In Bearbeitung mit Version, Sperre fällt beim Schließen", async () => {
    const [laura, mika] = await usersByKey(db, ["laura", "mika"]);
    const task = await newPm(laura);
    await saveContent(deps, laura, task.id, await contentWith(task.id, { headline: "Neue Headline" }));
    const after = await db.task.findUniqueOrThrow({ where: { id: task.id }, include: { document: { include: { versions: true } } } });
    expect(after.status).toBe("IN_BEARBEITUNG");
    expect(after.document?.versions.map((v) => [v.reason, v.status])).toEqual([["STATUSWECHSEL", "IN_BEARBEITUNG"]]);
    // nur wer die Aufgabe bearbeiten darf, schreibt
    await expect(saveContent(deps, mika, task.id, await contentWith(task.id, {}))).rejects.toThrow(ForbiddenError);
    await releaseLock(deps, laura, task.id);
    expect((await db.document.findUniqueOrThrow({ where: { taskId: task.id } })).lockedBy).toBeNull();
  });

  it("die Bausteine der Vorlage lassen sich nicht entfernen", async () => {
    const laura = (await usersByKey(db, ["laura"]))[0];
    const task = await newPm(laura);
    const content = await contentWith(task.id, {});
    content.content = content.content!.slice(1);
    await expect(saveContent(deps, laura, task.id, content)).rejects.toThrow("Bausteine");
  });
});

describe("Freigabe (BRIEFING 6.4) und Versand (6.5)", () => {
  it("vollständiger Ablauf: anfragen, prüfen, Änderungen, freigeben, beim Kunden, Rückläufer, zweite Freigabe, Medien, Ablage", async () => {
    const [laura, lukas, lars] = await usersByKey(db, ["laura", "lukas", "lars"]);
    const task = await newPm(laura);
    await saveContent(deps, laura, task.id, await contentWith(task.id, { headline: "Covenant baut in Sachsen", lead: "Covenant errichtet einen Standort." }));

    // ohne Prüfung fragt impress einmal nach
    await expect(requestApproval(deps, laura, task.id, {})).rejects.toThrow(CheckConfirmationRequired);
    await requestApproval(deps, laura, task.id, { confirmWithoutCheck: true, note: "Bitte bis Mittag" });
    const approval = await db.approval.findFirstOrThrow({ where: { document: { taskId: task.id } } });
    expect(approval.requestedApproverIds.sort()).toEqual([lars.id, lukas.id].sort());
    expect(await db.notification.count({ where: { kind: "APPROVAL_REQUESTED" } })).toBe(2);

    // Owner darf nicht selbst freigeben
    await expect(decideApproval(deps, laura, task.id, { decision: "FREIGEGEBEN" })).rejects.toThrow(ForbiddenError);

    // Lukas übernimmt, Lars sieht "prüft gerade" und übernimmt nur mit Bestätigung
    expect(await claimApproval(deps, lukas, task.id)).toEqual({ claimed: true, claimedBy: lukas.id });
    expect(await claimApproval(deps, lars, task.id)).toEqual({ claimed: false, claimedBy: lukas.id });
    await expect(decideApproval(deps, lars, task.id, { decision: "FREIGEGEBEN" })).rejects.toThrow(DomainError);

    // Änderungen anfordern nur mit Kommentar
    await expect(decideApproval(deps, lukas, task.id, { decision: "AENDERUNGEN" })).rejects.toThrow(DomainError);
    await decideApproval(deps, lukas, task.id, { decision: "AENDERUNGEN", note: "Zahl prüfen" });
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("AENDERUNGEN_ANGEFORDERT");

    await saveContent(deps, laura, task.id, await contentWith(task.id, { headline: "Covenant baut in Sachsen", lead: "Covenant errichtet 450 Stellen." }));
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("IN_BEARBEITUNG");
    await requestApproval(deps, laura, task.id, { confirmWithoutCheck: true, approverIds: [lukas.id] });
    await claimApproval(deps, lukas, task.id);
    // der Freigeber ändert direkt im Text (die Markierung setzt der Editor)
    expect((await openForEditing(deps, lukas, task.id)).editing).toBe(true);
    await saveContent(deps, lukas, task.id, await contentWith(task.id, { headline: "Covenant baut in Leipzig", lead: "Covenant errichtet 450 Stellen." }));
    await decideApproval(deps, lukas, task.id, { decision: "FREIGEGEBEN" });
    const granted = await db.approval.findFirstOrThrow({ where: { document: { taskId: task.id }, decision: "FREIGEGEBEN" }, include: { version: true } });
    expect(granted.isSelfApproval).toBe(false);
    expect(blockTexts(granted.version.content as JSONNode).find((b) => b.key === "headline")?.text).toBe("Covenant baut in Leipzig");
    expect(await db.auditLog.count({ where: { action: "APPROVAL_GRANTED" } })).toBe(1);

    // freigegeben ist gesperrt
    await expect(saveContent(deps, laura, task.id, await contentWith(task.id, {}))).rejects.toThrow(ForbiddenError);

    // an Kunden zur Abstimmung
    await recordDispatch(deps, laura, task.id, { target: "KUNDE_ABSTIMMUNG", recipients: "Kommunikation Covenant", channel: "Mail" });
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("BEIM_KUNDEN");

    // Rückläufer: Word-Datei des Kunden, neue Version, zurück in die Bearbeitung
    const exported = await exportDocument(deps, laura, task.id, { kind: "docx", template: "RP" });
    expect(exported.fileName).toMatch(/^2026-10-20_Covenant_Pressemitteilung_Standort_Sachsen_v\d+\.docx$/);
    const revised = await buildDocx({
      content: await contentWith(task.id, { headline: "Covenant baut in Leipzig", lead: "Covenant errichtet rund 450 Stellen." }),
      format: "PRESSEMITTEILUNG", title: "x", template: { logo: null, color: "000000", font: "Arial" },
    });
    await importWord(deps, laura, task.id, { name: "Rueckmeldung_Kunde.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", data: revised });
    const afterImport = await db.task.findUniqueOrThrow({ where: { id: task.id }, include: { document: { include: { versions: { orderBy: { number: "desc" } } } } } });
    expect(afterImport.status).toBe("IN_BEARBEITUNG");
    expect(afterImport.document?.versions[0]?.reason).toBe("IMPORT");

    // zweite Freigabe, Versand an Medien, Ablage im SharePoint
    await requestApproval(deps, laura, task.id, { confirmWithoutCheck: true });
    await claimApproval(deps, lars, task.id);
    await decideApproval(deps, lars, task.id, { decision: "FREIGEGEBEN" });
    const { sharePointFileUrl } = await recordDispatch(deps, laura, task.id, { target: "MEDIEN", recipients: "Verteiler Leitmedien", channel: "Mail" });
    const done = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(done.status).toBe("ERLEDIGT");
    expect(done.completedAt).toEqual(FIXED_NOW);
    const folder = path.join(deps.storageDir, "sharepoint-mock", "impress", "Kunden", "Covenant", "02_Pressemitteilungen", "2026");
    const files = await readdir(folder);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^2026-10-20_Covenant_Pressemitteilung_Standort_Sachsen_v\d+\.docx$/);
    expect(sharePointFileUrl).toContain(files[0]);
    // die Leistung "Pressemitteilungen" zählt hoch
    const service = await db.agreedService.findFirstOrThrow({ where: { title: "Pressemitteilungen" } });
    expect(await doneCount(db, service)).toBe(1);
  });

  it("Kunde einverstanden: Freigabe bleibt gültig", async () => {
    const [hannah, lars] = await usersByKey(db, ["hannah", "lars"]);
    const task = await db.task.findFirstOrThrow({ where: { title: "Briefing für Gespräch im Ministerium" } });
    const robin = (await usersByKey(db, ["robin"]))[0];
    await expect(clientAgreed(deps, hannah, task.id)).rejects.toThrow(ForbiddenError);
    await clientAgreed(deps, robin, task.id);
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("FREIGEGEBEN");
    await reopenForEditing(deps, lars, task.id);
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("IN_BEARBEITUNG");
  });

  it("Selbstfreigabe nur mit Zusatzrecht und markiert; Rückzug durch den Owner", async () => {
    const [lars, lukas] = await usersByKey(db, ["lars", "lukas"]);
    const task = await newPm(lukas);
    await saveContent(deps, lukas, task.id, await contentWith(task.id, { headline: "Eigener Text" }));
    await requestApproval(deps, lukas, task.id, { confirmWithoutCheck: true });
    await expect(decideApproval(deps, lukas, task.id, { decision: "FREIGEGEBEN" })).rejects.toThrow(ForbiddenError);
    await withdrawApproval(deps, lukas, task.id);
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("IN_BEARBEITUNG");

    await db.permissionGrant.create({ data: { userId: lukas.id, permission: "SELF_APPROVE", grantedById: lars.id } });
    await requestApproval(deps, lukas, task.id, { confirmWithoutCheck: true });
    await decideApproval(deps, lukas, task.id, { decision: "FREIGEGEBEN" });
    const approval = await db.approval.findFirstOrThrow({ where: { decision: "FREIGEGEBEN", document: { taskId: task.id } } });
    expect(approval.isSelfApproval).toBe(true);
    expect(await db.auditLog.count({ where: { action: "SELF_APPROVAL" } })).toBe(1);
  });

  it("Freigabe anfragen ist gesperrt, solange KI-Bausteine offen sind", async () => {
    const laura = (await usersByKey(db, ["laura"]))[0];
    const task = await newPm(laura);
    await saveContent(deps, laura, task.id, await contentWith(task.id, { headline: "x" }));
    const doc = await db.document.findUniqueOrThrow({ where: { taskId: task.id } });
    await db.aiInsertion.create({ data: { documentId: doc.id, kind: "HEADLINE" } });
    await expect(requestApproval(deps, laura, task.id, { confirmWithoutCheck: true })).rejects.toThrow("KI-Bausteine");
  });

  it("Export als PDF und Kundenvorlage nur mit Kundenlogo", async () => {
    const laura = (await usersByKey(db, ["laura"]))[0];
    const task = await db.task.findFirstOrThrow({ where: { title: "PM Standortentscheidung" } });
    const pdf = await exportDocument(deps, laura, task.id, { kind: "pdf", template: "RP" });
    expect(Buffer.from(pdf.data.slice(0, 4)).toString()).toBe("%PDF");
    await expect(exportDocument(deps, laura, task.id, { kind: "docx", template: "KUNDE" })).rejects.toThrow(DomainError);
  }, 60_000);
});

describe("Kommentare (BRIEFING 7.3)", () => {
  it("mit Antworten, erledigt und Benachrichtigung an Owner und Erwähnte", async () => {
    const [laura, lukas, robin] = await usersByKey(db, ["laura", "lukas", "robin"]);
    const task = await db.task.findFirstOrThrow({ where: { title: "PM Standortentscheidung" } });
    const root = await addComment(deps, lukas, task.id, { body: "Zahl prüfen, @Robin bitte gegenlesen" });
    expect(root.anchor).toEqual({ wholeText: true });
    expect(await db.notification.count({ where: { userId: laura.id, kind: "COMMENT" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: robin.id, kind: "COMMENT" } })).toBe(1);
    await addComment(deps, laura, task.id, { body: "Erledigt, 450 stimmt", threadId: root.id });
    expect(await db.notification.count({ where: { userId: lukas.id, kind: "COMMENT" } })).toBe(1);
    await resolveThread(deps, laura, task.id, root.id, true);
    expect(await db.comment.count({ where: { threadId: root.id, resolvedAt: { not: null } } })).toBe(2);
    await expect(addComment(deps, laura, task.id, { body: "  " })).rejects.toThrow(DomainError);
  });
});

describe("Versionen (BRIEFING 7.3)", () => {
  it("manuell und bei jedem Statuswechsel, fortlaufend nummeriert", async () => {
    const laura = (await usersByKey(db, ["laura"]))[0];
    const task = await newPm(laura);
    await saveContent(deps, laura, task.id, await contentWith(task.id, { headline: "eins" }));
    await saveManualVersion(deps, laura, task.id);
    await requestApproval(deps, laura, task.id, { confirmWithoutCheck: true });
    const versions = await db.documentVersion.findMany({ where: { document: { taskId: task.id } }, orderBy: { number: "asc" } });
    expect(versions.map((v) => [v.number, v.reason, v.status])).toEqual([
      [1, "STATUSWECHSEL", "IN_BEARBEITUNG"],
      [2, "MANUELL", "IN_BEARBEITUNG"],
      [3, "STATUSWECHSEL", "FREIGABE_ANGEFRAGT"],
    ]);
  });
});

describe("Projekte (BRIEFING 6.6) und Kundenordner (9)", () => {
  it("Roundtable schlägt Aufgaben vor; Abschluss zählt die vereinbarte Leistung", async () => {
    const lukas = (await usersByKey(db, ["lukas"]))[0];
    const covenant = await clientByName(db, "Covenant");
    const service = await db.agreedService.findFirstOrThrow({ where: { title: "Journalisten-Roundtable" } });
    const project = await createProject(deps, lukas, {
      clientId: covenant.id, title: "Roundtable Winter", kind: "ROUNDTABLE", agreedServiceId: service.id,
      suggestedTasks: ["KONZEPT", "EINLADUNG", "QA"], taskDueAt: later(60 * 24 * 7),
    });
    const tasks = await db.task.findMany({ where: { projectId: project.id }, include: { document: true } });
    expect(tasks.map((t) => t.document?.format).sort()).toEqual(["EINLADUNG", "KONZEPT", "QA"]);
    expect(await doneCount(db, service)).toBe(0);
    await setProjectStatus(deps, lukas, project.id, "LAUFEND");
    await setProjectStatus(deps, lukas, project.id, "ABGESCHLOSSEN");
    expect(await doneCount(db, service)).toBe(1);
  });

  it("legt beim Anlegen eines Kunden die Ordnerstruktur an", async () => {
    const lars = (await usersByKey(db, ["lars"]))[0];
    const client = await createClient(deps, lars, { name: "Capital.com", shortName: "Capital com" });
    expect(client.sharePointFolderPath).toBe("Capital_com");
    const root = path.join(deps.storageDir, "sharepoint-mock", "impress", "Kunden", "Capital_com");
    expect((await readdir(root)).sort()).toEqual([
      "01_Kundenprofil", "02_Pressemitteilungen", "03_Statements", "04_Medienansprache", "05_Social_Media",
      "06_Pressespiegel_und_Einschaetzungen", "07_Projekte", "08_Briefings_und_Konzepte", "99_Archiv",
    ]);
    expect((await readdir(path.join(root, "01_Kundenprofil"))).sort()).toEqual(["Factsheets", "QA", "Strategie_und_Ansatz", "Styleguide_und_Compliance"]);
  });
});
