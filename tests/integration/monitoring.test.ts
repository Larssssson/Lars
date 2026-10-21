import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { requestApproval } from "@/lib/domain/approvals/service";
import { createArticleDraft, createPressReview, createPressReviewTasks, linkedinAvailable, takeOverAuthor } from "@/lib/domain/monitoring/actions";
import {
  createManualArticle,
  guessMonitoringMapping,
  importMonitoringFile,
  purgeExpiredFullTexts,
  setFullText,
  uploadMonitoringFile,
} from "@/lib/domain/monitoring/articles";
import { allArticles, monitoringTile, rateArticles, setSelected, todayRelevant } from "@/lib/domain/monitoring/relevance";
import { updateShiftType } from "@/lib/domain/shifts";
import { listTasks } from "@/lib/domain/tasks/queries";
import { blockTexts, type JSONNode } from "@/lib/editor/content";
import { createPrismaClient } from "@/lib/db";
import { atTime } from "@/lib/time";
import { clientsByName, FIXED_NOW, resetAndSeed, testDeps, usersByKey, type TestDeps } from "./helpers";

const db = createPrismaClient();
let deps: TestDeps;

beforeEach(async () => {
  await resetAndSeed(db);
  deps = await testDeps(db);
});

async function fixture(name: string) {
  const mimeType = name.endsWith(".csv") ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return { name, mimeType, data: new Uint8Array(await readFile(path.resolve("fixtures/monitoring", name))) };
}

async function importSample(name = "meltwater_sample.csv") {
  const [mika] = await usersByKey(db, ["mika"] as const);
  const upload = await uploadMonitoringFile(deps, mika, await fixture(name));
  const result = await importMonitoringFile(deps, mika, { fileId: upload.fileId, mapping: upload.mapping });
  return { mika, upload, result };
}

const byUrl = (url: string) => db.article.findFirstOrThrow({ where: { url: `https://example.org/${url}` } });

describe("Import Meltwater (BRIEFING 7.6, 13.3)", () => {
  it("CSV: Zuordnung, gleiche Artikel zusammengefasst, bekannte Autoren zugeordnet, Zuordnung gespeichert", async () => {
    const { upload, result, mika } = await importSample();
    expect(upload.savedApplied).toBe(false);
    expect(upload.mapping).toMatchObject({ Date: "publishedAt", Headline: "headline", URL: "url", "Opening Text": "teaser", "Hit Sentence": "teaser", Source: "media", Influencer: "author", Language: "language", Reach: "reach", Country: "" });
    expect(result.created).toHaveLength(37);
    expect(result.merged).toBe(3);
    expect(result.assigned).toBe(19);
    const a1 = await byUrl("tagesblatt/a1");
    expect(a1).toMatchObject({ headline: "Neue Produktionsstätte für Rüstungsgüter in Sachsen geplant", mediaName: "Tagesblatt Nord", authorName: "Peter Albrecht", reach: 850000 });
    expect(a1.teaser).toBe("Ein US-Unternehmen prüft einen Standort bei Leipzig. Der Standort könnte mehrere hundert Arbeitsplätze bringen.");
    const peter = await db.journalist.findFirstOrThrow({ where: { lastName: "Albrecht" } });
    expect(a1.journalistId).toBe(peter.id);
    // unbekannte Autoren bleiben ohne Kontakt (kein neuer Kontakt beim Import)
    expect((await byUrl("wehrtechnik/g1")).journalistId).toBeNull();
    expect(await db.journalist.count()).toBe(8);

    // zweiter Import: gespeicherte Zuordnung, alles schon vorhanden
    const again = await uploadMonitoringFile(deps, mika, await fixture("meltwater_sample.xlsx"));
    expect(again.savedApplied).toBe(true);
    const second = await importMonitoringFile(deps, mika, { fileId: again.fileId, mapping: again.mapping });
    expect(second).toMatchObject({ created: [], merged: 40 });
    expect(await db.importMapping.count({ where: { kind: "MONITORING" } })).toBe(1);
  });

  it("XLSX liefert dieselben Artikel; fehlende Pflichtfelder in der Zuordnung werden abgelehnt", async () => {
    const [mika] = await usersByKey(db, ["mika"] as const);
    const upload = await uploadMonitoringFile(deps, mika, await fixture("meltwater_sample.xlsx"));
    await expect(importMonitoringFile(deps, mika, { fileId: upload.fileId, mapping: { Headline: "headline" } })).rejects.toThrow(/Headline, Medium und Datum/);
    const result = await importMonitoringFile(deps, mika, { fileId: upload.fileId, mapping: upload.mapping });
    expect(result.created).toHaveLength(37);
    const [laura] = await usersByKey(db, ["laura"] as const);
    await expect(importMonitoringFile(deps, laura, { fileId: upload.fileId, mapping: upload.mapping })).rejects.toThrow();
    expect(guessMonitoringMapping(["Datum", "Titel", "Link", "Quelle", "Autor"])).toEqual({ Datum: "publishedAt", Titel: "headline", Link: "url", Quelle: "media", Autor: "author" });
  });

  it("Artikel von Hand, Dublette zu einem importierten Artikel wird zusammengefasst", async () => {
    await importSample();
    const [laura] = await usersByKey(db, ["laura"] as const);
    const manual = await createManualArticle(deps, laura, { headline: "Gastbeitrag zur Verteidigungspolitik", media: "Tagesblatt Nord", author: "Jana Hofmann", url: "https://example.org/tagesblatt/gast" });
    expect(manual.created).toHaveLength(1);
    expect(manual.assigned).toBe(1);
    const dup = await createManualArticle(deps, laura, { headline: "irgendwas", media: "Tagesblatt Nord", url: "https://example.org/tagesblatt/a1" });
    expect(dup).toMatchObject({ created: [], merged: 1 });
  });
});

describe("Relevanz und Sichtung (BRIEFING 7.6 Schritte 3 bis 5)", () => {
  it("Wert und Begründung pro Kunde, Heute relevant: Top 10 ab 50, Alle Artikel mit Suche", async () => {
    const { result } = await importSample();
    const rating = await rateArticles(deps, result.created);
    expect(rating.rated).toEqual(["Covenant", "Ground A", "Rafael"]);
    const [covenant, groundA, rafael] = await clientsByName(db, ["Covenant", "Ground A", "Rafael"] as const);
    const relevance = await db.articleRelevance.findFirstOrThrow({ where: { clientId: covenant.id, article: { url: "https://example.org/tagesblatt/a1" } } });
    expect(relevance).toMatchObject({ score: 95, reason: expect.stringContaining("Produktionsstätte"), model: expect.stringMatching(/^claude-/), promptVersion: "relevance@1" });

    const today = await todayRelevant(db, covenant.id, FIXED_NOW);
    expect(today).toHaveLength(10);
    expect(today[0]!.url).toBe("https://example.org/tagesblatt/a1");
    expect(today.every((a) => a.relevances.find((r) => r.clientId === covenant.id)!.score! >= 50)).toBe(true);
    expect((await todayRelevant(db, groundA.id, FIXED_NOW)).length).toBe(6);
    expect((await todayRelevant(db, rafael.id, FIXED_NOW))[0]!.url).toBe("https://example.org/hauptstadt/b7");
    expect(await todayRelevant(db, covenant.id, new Date(FIXED_NOW.getTime() + 86_400_000))).toHaveLength(0);

    // 37 importierte plus 6 Artikel der Artikel-Historie aus dem Seed
    expect((await allArticles(db, {})).length).toBe(43);
    expect((await allArticles(db, { q: "Luftverteidigung" })).map((a) => a.url).sort()).toEqual([
      "https://example.org/hauptstadt/b11",
      "https://example.org/hauptstadt/b7",
      "https://example.org/tagesblatt/a8",
      "https://example.org/wehrtechnik/g2",
    ]);
    expect((await allArticles(db, { q: "Ole Brandt" })).length).toBe(2);
  });

  it("KI erlaubt aus: keine Bewertung für diesen Kunden, Auswahl trotzdem möglich", async () => {
    const { result, mika } = await importSample();
    const [rafael] = await clientsByName(db, ["Rafael"] as const);
    await db.client.update({ where: { id: rafael.id }, data: { aiAllowed: false } });
    const rating = await rateArticles(deps, result.created);
    expect(rating.skipped).toEqual(["Rafael"]);
    expect(await db.articleRelevance.count({ where: { clientId: rafael.id } })).toBe(0);
    const b7 = await byUrl("hauptstadt/b7");
    await setSelected(deps, mika, b7.id, rafael.id, true);
    expect(await db.articleRelevance.findFirstOrThrow({ where: { clientId: rafael.id } })).toMatchObject({ selected: true, score: null, selectedBy: mika.id });
  });

  it("Volltext nur für die Zusammenfassung, nach 30 Tagen gelöscht", async () => {
    const { mika } = await importSample();
    const a1 = await byUrl("tagesblatt/a1");
    const saved = await setFullText(deps, mika, a1.id, "Volltext des Artikels.");
    expect(saved.fullTextExpiresAt!.getTime()).toBeGreaterThan(FIXED_NOW.getTime() + 30 * 86_400_000);
    deps.clock.now = new Date(FIXED_NOW.getTime() + 30 * 86_400_000);
    expect(await purgeExpiredFullTexts(deps)).toBe(0);
    deps.clock.now = new Date(FIXED_NOW.getTime() + 32 * 86_400_000);
    expect(await purgeExpiredFullTexts(deps)).toBe(1);
    expect((await byUrl("tagesblatt/a1")).fullTextPasted).toBeNull();
  });
});

describe("Aktionen und Pressespiegel (BRIEFING 7.6 Schritte 6 bis 8, 13.9)", () => {
  it("Einschätzung als Aufgabe mit KI-Entwurf, ein Baustein, Freigabeanfrage gesperrt", async () => {
    const { result, mika } = await importSample();
    await rateArticles(deps, result.created);
    const [covenant] = await clientsByName(db, ["Covenant"] as const);
    const a1 = await byUrl("tagesblatt/a1");
    await expect(createArticleDraft(deps, mika, a1.id, covenant.id, "EINSCHAETZUNG")).rejects.toThrow(/nicht aufgenommen/);
    await setSelected(deps, mika, a1.id, covenant.id, true);
    const draft = await createArticleDraft(deps, mika, a1.id, covenant.id, "EINSCHAETZUNG");
    expect(draft.aiNotice).toBeNull();
    const task = await db.task.findUniqueOrThrow({ where: { id: draft.taskId }, include: { document: true } });
    expect(task).toMatchObject({ clientId: covenant.id, ownerId: mika.id, title: "Einschätzung: Neue Produktionsstätte für Rüstungsgüter in Sachsen geplant" });
    const blocks = Object.fromEntries(blockTexts(task.document!.content as JSONNode).map((b) => [b.key, b.text]));
    expect(blocks.bezugsartikel).toBe("Neue Produktionsstätte für Rüstungsgüter in Sachsen geplant\nTagesblatt Nord, 19.10.2026, Peter Albrecht, https://example.org/tagesblatt/a1");
    expect(blocks.bedeutung).toContain("Leitmedium");
    const insertions = await db.aiInsertion.findMany({ where: { documentId: task.document!.id } });
    expect(insertions).toHaveLength(1);
    expect(insertions[0]).toMatchObject({ status: "OFFEN", promptVersion: "article-draft@1" });
    const marked = JSON.stringify(task.document!.content).split(insertions[0]!.id).length - 1;
    expect(marked).toBeGreaterThanOrEqual(3);
    await db.task.update({ where: { id: task.id }, data: { status: "IN_BEARBEITUNG" } });
    await expect(requestApproval(deps, mika, task.id, { confirmWithoutCheck: true })).rejects.toThrow(/KI-Baustein/);
    expect(await db.articleAction.findFirst({ where: { articleId: a1.id, kind: "EINSCHAETZUNG" } })).toMatchObject({ resultTaskId: task.id });
  });

  it("LinkedIn-Kommentar nur mit Leistung LinkedIn, Pitch zählt auf die Leistung Medien-Pitch", async () => {
    const { result, mika } = await importSample();
    await rateArticles(deps, result.created);
    const [groundA, rafael] = await clientsByName(db, ["Ground A", "Rafael"] as const);
    expect(await linkedinAvailable(deps, groundA.id)).toBe(true);
    expect(await linkedinAvailable(deps, rafael.id)).toBe(false);
    const b7 = await byUrl("hauptstadt/b7");
    await setSelected(deps, mika, b7.id, rafael.id, true);
    await expect(createArticleDraft(deps, mika, b7.id, rafael.id, "LINKEDIN_KOMMENTAR")).rejects.toThrow(/LinkedIn/);
    const pitch = await createArticleDraft(deps, mika, b7.id, rafael.id, "NEWSHOOK_PITCH");
    const pitchTask = await db.task.findUniqueOrThrow({ where: { id: pitch.taskId }, include: { agreedService: true, document: true } });
    expect(pitchTask.agreedService?.category).toBe("MEDIEN_PITCH");
    expect(pitchTask.description).toBe("Pitch an Tim Neumann (Hauptstadt Kurier, Politik)");
    expect(pitchTask.document!.format).toBe("MEDIEN_PITCH");

    const c4 = await byUrl("kurier/c4");
    await setSelected(deps, mika, c4.id, groundA.id, true);
    const comment = await createArticleDraft(deps, mika, c4.id, groundA.id, "LINKEDIN_KOMMENTAR");
    const commentTask = await db.task.findUniqueOrThrow({ where: { id: comment.taskId }, include: { agreedService: true } });
    expect(commentTask).toMatchObject({ category: "DIGITALE_KOMMUNIKATION" });
    expect(commentTask.agreedService?.category).toBe("LINKEDIN");
  });

  it("Ohne KI entsteht die Aufgabe mit Bezugsartikel und leeren Bausteinen", async () => {
    const { result, mika } = await importSample();
    await rateArticles(deps, result.created);
    const [covenant] = await clientsByName(db, ["Covenant"] as const);
    await db.client.update({ where: { id: covenant.id }, data: { aiAllowed: false } });
    const d2 = await byUrl("sachsen/d2");
    await setSelected(deps, mika, d2.id, covenant.id, true);
    const draft = await createArticleDraft(deps, mika, d2.id, covenant.id, "EINSCHAETZUNG");
    expect(draft.aiNotice).toMatch(/ausgeschaltet/);
    expect(await db.aiInsertion.count()).toBe(0);
  });

  it("Autor übernehmen: Kontakt mit Label Pressespiegel, Artikel zugeordnet; bekannte Autoren nicht", async () => {
    const { result, mika } = await importSample();
    await rateArticles(deps, result.created);
    const [covenant] = await clientsByName(db, ["Covenant"] as const);
    const g1 = await byUrl("wehrtechnik/g1");
    const a1 = await byUrl("tagesblatt/a1");
    await setSelected(deps, mika, g1.id, covenant.id, true);
    await setSelected(deps, mika, a1.id, covenant.id, true);
    await expect(takeOverAuthor(deps, mika, a1.id, covenant.id)).rejects.toThrow(/schon im Journo Hub/);
    const { journalistId } = await takeOverAuthor(deps, mika, g1.id, covenant.id);
    const karla = await db.journalist.findUniqueOrThrow({ where: { id: journalistId }, include: { owners: true, articles: true, media: true } });
    expect(karla).toMatchObject({ firstName: "Karla", lastName: "Weiß", status: "PRESSESPIEGEL", verifiedAt: null });
    expect(karla.media?.name).toBe("Wehrtechnik Aktuell");
    expect(karla.owners.map((o) => o.userId)).toEqual([mika.id]);
    expect(karla.articles.map((a) => a.url).sort()).toEqual(["https://example.org/wehrtechnik/g1", "https://example.org/wehrtechnik/g4"]);
  });

  it("Pressespiegel pro Kunde wie 13.9: Titel, Medium, Datum, Link, Kurzfassung als KI-Baustein, Einschätzung", async () => {
    const { result, mika } = await importSample();
    await rateArticles(deps, result.created);
    const [covenant] = await clientsByName(db, ["Covenant"] as const);
    await expect(createPressReview(deps, mika, covenant.id)).rejects.toThrow(/keine Artikel aufgenommen/);
    for (const url of ["tagesblatt/a1", "sachsen/d2"]) await setSelected(deps, mika, (await byUrl(url)).id, covenant.id, true);
    const review = await createPressReview(deps, mika, covenant.id);
    expect(review.articles).toBe(2);
    const task = await db.task.findUniqueOrThrow({ where: { id: review.taskId }, include: { document: true } });
    expect(task.title).toBe("Pressespiegel Covenant 20.10.2026");
    expect(task.document!.title).toBe("Pressespiegel Covenant, 20. Oktober 2026");
    const blocks = Object.fromEntries(blockTexts(task.document!.content as JSONNode).map((b) => [b.key, b.text]));
    expect(blocks.datum).toBe("20. Oktober 2026");
    expect(blocks.artikel!.split("\n").slice(0, 8)).toEqual([
      "1. Neue Produktionsstätte für Rüstungsgüter in Sachsen geplant",
      "Tagesblatt Nord, 19.10.2026, Peter Albrecht, https://example.org/tagesblatt/a1",
      "Kurzfassung: Das Blatt berichtet über die Standortsuche eines US-Unternehmens bei Leipzig und erwartet mehrere hundert Arbeitsplätze.",
      "Einschätzung: [Einschätzung ergänzen]",
      "2. Stadtrat diskutiert Gewerbegebiet Nord",
      "Sachsen Rundschau, 19.10.2026, Stefan Lorenz, https://example.org/sachsen/d2",
      expect.stringMatching(/^Kurzfassung: /),
      "Einschätzung: [Einschätzung ergänzen]",
    ]);
    expect(await db.aiInsertion.count({ where: { documentId: task.document!.id, status: "OFFEN" } })).toBe(2);
    // ein Artikel steht nur einmal in einem Pressespiegel
    await expect(createPressReview(deps, mika, covenant.id)).rejects.toThrow(/keine Artikel aufgenommen/);
  });
});

describe("Pressespiegel-Aufgabe aus dem Dienstplan und Kachel (BRIEFING 7.6 Schritt 1, 7.1)", () => {
  it("legt zu Dienstbeginn die Aufgabe an, Kunde RP intern, bei jeder Kundenauswahl sichtbar", async () => {
    const shift = await db.shift.findFirstOrThrow({ where: { date: new Date("2026-10-20T00:00:00.000Z"), shiftType: { key: "PRESSESPIEGEL" } }, include: { user: true } });
    deps.clock.now = atTime("2026-10-20", "06:45");
    expect(await createPressReviewTasks(deps)).toBe(0);
    deps.clock.now = atTime("2026-10-20", "07:05");
    expect(await createPressReviewTasks(deps)).toBe(1);
    expect(await createPressReviewTasks(deps)).toBe(0);
    const task = await db.task.findFirstOrThrow({ where: { title: "Pressespiegel 20.10.2026" }, include: { client: true } });
    expect(task).toMatchObject({ ownerId: shift.userId, category: "INTERN", type: "AUFGABE" });
    expect(task.dueAt).toEqual(atTime("2026-10-20", "09:30"));
    expect(task.client).toMatchObject({ name: "RP intern", isInternal: true });
    expect(await db.notification.count({ where: { userId: shift.userId, kind: "TASK_ASSIGNED" } })).toBeGreaterThan(0);
    const [covenant] = await clientsByName(db, ["Covenant"] as const);
    expect((await listTasks(db, { clientId: covenant.id, ownerId: shift.userId }, FIXED_NOW)).some((t) => t.id === task.id)).toBe(true);
    // am Wochenende kein Pressespiegel-Dienst
    deps.clock.now = atTime("2026-10-24", "08:00");
    expect(await createPressReviewTasks(deps)).toBe(0);
  });

  it("Frist der Pressespiegel-Aufgabe ist in der Verwaltung einstellbar", async () => {
    const [lars] = await usersByKey(db, ["lars"] as const);
    const type = await db.shiftType.findUniqueOrThrow({ where: { key: "PRESSESPIEGEL" } });
    await updateShiftType(deps, lars, type.id, { ...type, taskDueTime: "10:15" });
    deps.clock.now = atTime("2026-10-20", "07:05");
    expect(await createPressReviewTasks(deps)).toBe(1);
    expect((await db.task.findFirstOrThrow({ where: { title: "Pressespiegel 20.10.2026" } })).dueAt).toEqual(atTime("2026-10-20", "10:15"));
  });

  it("Kachel: heute importiert, relevant, aufgenommen, Dienst", async () => {
    const { result, mika } = await importSample();
    await rateArticles(deps, result.created);
    const [covenant] = await clientsByName(db, ["Covenant"] as const);
    await setSelected(deps, mika, (await byUrl("tagesblatt/a1")).id, covenant.id, true);
    const tile = await monitoringTile(db, null, FIXED_NOW);
    expect(tile).toMatchObject({ imported: 37, relevant: 22, selected: 1 });
    expect(tile.serviceName).toBeTruthy();
    expect((await monitoringTile(db, covenant.id, FIXED_NOW)).relevant).toBe(10);
  });
});
