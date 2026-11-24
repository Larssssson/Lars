import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@/lib/db";
import { DomainError } from "@/lib/domain/errors";
import { ForbiddenError } from "@/lib/domain/permissions";
import { approveReport, createReport, deleteReport, exportReport, reportDefaults, reportPreview, updateReport, type ReportInput } from "@/lib/domain/reports/service";
import { TEMPLATES } from "@/lib/domain/reports/templates";
import { atTime } from "@/lib/time";
import { clientByName, resetAndSeed, testDeps, usersByKey, type TestDeps } from "./helpers";

const db = createPrismaClient();
let deps: TestDeps;

beforeEach(async () => {
  await resetAndSeed(db);
  deps = await testDeps(db);
});

async function file() {
  return { name: "meltwater.csv", mimeType: "text/csv", data: new Uint8Array(await readFile("fixtures/reports/meltwater_reporting_sample.csv")) };
}

async function input(overrides: Partial<ReportInput> = {}): Promise<ReportInput> {
  const covenant = await clientByName(db, "Covenant");
  return {
    clientId: covenant.id,
    template: "MONATSBERICHT",
    periodStart: atTime("2026-10-01", "00:00"),
    periodEnd: atTime("2026-10-31", "00:00"),
    blocks: [...TEMPLATES.MONATSBERICHT.defaults],
    clientAliases: [],
    competitors: ["Northwind Defence", "Helix Systems"],
    tier1: ["Nachrichten 24", "Tagesblatt Nord"],
    tier2: ["Hauptstadt Kurier"],
    excludePaid: true,
    topicFilter: [],
    commentary: "Der Standort war das Thema des Monats.",
    ...overrides,
  };
}

describe("Reporting (D-133)", () => {
  it("Vorbelegung aus dem Kundenprofil, danach aus dem letzten Reporting", async () => {
    const covenant = await clientByName(db, "Covenant");
    const before = await reportDefaults(deps, covenant.id);
    expect(Array.isArray(before.competitors)).toBe(true);
    const [laura] = await usersByKey(db, ["laura"]);
    await createReport(deps, laura, await input({ competitors: ["Northwind Defence"] }), await file());
    expect((await reportDefaults(deps, covenant.id)).competitors).toEqual(["Northwind Defence"]);
  });

  it("prüft Export, Zeitraum und Bausteine", async () => {
    const [laura] = await usersByKey(db, ["laura"]);
    await expect(createReport(deps, laura, await input(), null)).rejects.toThrow(DomainError);
    await expect(createReport(deps, laura, await input(), { name: "x.pdf", mimeType: "application/pdf", data: new Uint8Array([1]) })).rejects.toThrow(DomainError);
    await expect(createReport(deps, laura, await input(), { name: "x.csv", mimeType: "text/csv", data: new TextEncoder().encode("Headline\nA\n") })).rejects.toThrow(/Datum, Quelle/);
    await expect(createReport(deps, laura, await input({ periodStart: atTime("2026-11-01", "00:00") }), await file())).rejects.toThrow();
    await expect(createReport(deps, laura, await input({ blocks: [] }), await file())).rejects.toThrow();
  });

  it("Vorschau, Word, PDF und PowerPoint; Entwurf bis zur Freigabe durch eine andere Person", async () => {
    const [laura, lukas] = await usersByKey(db, ["laura", "lukas"]);
    const report = await createReport(deps, laura, await input(), await file());
    expect(report.title).toBe("Medienreporting Covenant · Oktober 2026");

    const preview = await reportPreview(deps, report.id);
    expect(preview.total).toBeGreaterThan(0);
    expect(preview.html).toContain("Entwurf, nicht freigegeben");
    expect(preview.html).toContain("Share of Voice");
    expect(preview.html).toContain("Der Standort war das Thema des Monats.");
    expect(preview.html).toContain("<svg");

    const docx = await exportReport(deps, laura, report.id, "docx");
    const word = await JSZip.loadAsync(docx.data);
    const xml = await word.file("word/document.xml")!.async("string");
    expect(xml).toContain("Share of Voice");
    expect(Object.keys(word.files).some((f) => f.startsWith("word/media/"))).toBe(true);

    const pdf = await exportReport(deps, laura, report.id, "pdf");
    expect(Buffer.from(pdf.data.slice(0, 4)).toString()).toBe("%PDF");

    const pptx = await exportReport(deps, laura, report.id, "pptx");
    const deck = await JSZip.loadAsync(pptx.data);
    const slides = Object.keys(deck.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slides).toHaveLength(2);
    expect(Object.keys(deck.files).filter((f) => /^ppt\/charts\/chart\d+\.xml$/.test(f)).length).toBeGreaterThanOrEqual(3);

    await expect(approveReport(deps, laura, report.id, true)).rejects.toThrow(DomainError);
    await approveReport(deps, lukas, report.id, true);
    expect((await reportPreview(deps, report.id)).html).toContain("Freigegeben von Lukas");
    expect(await db.auditLog.count({ where: { action: "REPORT_APPROVED", entityId: report.id } })).toBe(1);

    // jede Änderung setzt zurück auf Entwurf
    await updateReport(deps, laura, report.id, await input({ template: "KOMPAKT", blocks: ["kennzahlen", "shareOfVoice"] }), null);
    const updated = await db.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(updated.status).toBe("ENTWURF");
    expect((await reportPreview(deps, report.id)).html).not.toContain("Einordnung");
  }, 120_000);

  it("Redakteur ohne Freigaberecht gibt nicht frei; löschen dürfen Ersteller und CVD", async () => {
    const [laura, robin, lars] = await usersByKey(db, ["laura", "robin", "lars"]);
    const report = await createReport(deps, laura, await input(), await file());
    await expect(approveReport(deps, robin, report.id, true)).rejects.toThrow(ForbiddenError);
    await expect(deleteReport(deps, robin, report.id)).rejects.toThrow(ForbiddenError);
    await deleteReport(deps, lars, report.id);
    expect(await db.report.count()).toBe(0);
    expect(await db.file.count({ where: { storageKey: { startsWith: "reports/" } } })).toBe(0);
  });
});
