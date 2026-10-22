import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { AiNotAllowedError } from "@/lib/ai/errors";
import {
  answerOnboardingQuestion,
  confirmSection,
  decideSuggestion,
  generateOnboardingQuestions,
  learnFromFinalText,
  loadProfile,
  missingForActivation,
  saveKpi,
  saveService,
  saveSpeaker,
  suggestChange,
  updateSection,
  uploadProfileDocument,
} from "@/lib/domain/clients/profile";
import { setClientStatus } from "@/lib/domain/clients/service";
import { warningsForClient } from "@/lib/domain/clients/warnings";
import { DomainError } from "@/lib/domain/errors";
import { ForbiddenError } from "@/lib/domain/permissions";
import { createPrismaClient } from "@/lib/db";
import { clientByName, clientsByName, FIXED_NOW, resetAndSeed, testDeps, usersByKey, type TestDeps } from "./helpers";

const db = createPrismaClient();
let deps: TestDeps;

beforeEach(async () => {
  await resetAndSeed(db);
  deps = await testDeps(db);
});

async function pdf(name: string) {
  return { name, mimeType: "application/pdf", data: new Uint8Array(await readFile(path.resolve("fixtures/clients/safenet", name))) };
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile()).map((e) => path.join(e.parentPath, e.name));
}

describe("Kundenprofil (BRIEFING 7.7, 13.1)", () => {
  it("Seed: Beispielinhalte, Sprecher und Bestätigungsdaten wie vorgegeben", async () => {
    const [covenant, groundA, rafael, safenet] = await clientsByName(db, ["Covenant", "Ground A", "Rafael", "SAFENET"] as const);
    const profile = await loadProfile(db, covenant.id);
    const facts = profile.sections.find((s) => s.def.key === "factsheet")!.content.fakten as { text: string }[];
    expect(facts).toHaveLength(4);
    expect(facts[0]!.text).toContain("450 Arbeitsplätze");
    expect(profile.speakers.map((s) => s.name)).toEqual(["[Beispiel] Dr. Anna Weber"]);
    for (const s of profile.sections.filter((x) => "fields" in x.def && x.row)) {
      for (const value of Object.values(s.content).flat()) {
        const text = typeof value === "string" ? value : value.text;
        if (text && !["Covenant", "Covenant Deutschland", "Standort Leipzig"].includes(text) && !/\(/.test(text)) expect(text).toMatch(/^\[Beispiel\]/);
      }
    }
    const groundFacts = (await loadProfile(db, groundA.id)).sections.find((s) => s.def.key === "factsheet")!.content.fakten;
    expect(groundFacts).toHaveLength(3);
    expect((await db.speaker.findMany({ where: { clientId: rafael.id } })).map((s) => s.name)).toEqual(["[Beispiel] Daniel Roth"]);
    expect(await db.clientProfileSection.count({ where: { clientId: safenet.id } })).toBe(0);
    expect((await db.speaker.findMany({ where: { isSampleData: false } })).length).toBe(0);

    const kinds = async (c: { id: string; name: string }) => (await warningsForClient(db, c, FIXED_NOW)).map((w) => `${w.kind}:${w.severity}`);
    expect(await kinds(groundA)).toContain("COMPLIANCE_STALE:ROT");
    expect(await kinds(rafael)).toContain("PROFILE_STALE:WARNUNG");
    expect(await kinds(covenant)).not.toContain("PROFILE_STALE:WARNUNG");
  });

  it("Kunden-Lead bearbeitet Kernbotschaften, Kommunikationsziele nur CVD; Speichern bestätigt", async () => {
    const [lars, lukas, laura] = await usersByKey(db, ["lars", "lukas", "laura"] as const);
    const rafael = await clientByName(db, "Rafael");
    deps.clock.now = new Date(FIXED_NOW.getTime() + 3_600_000);
    // Lars ist CVD und Lead bei Rafael
    await updateSection(deps, lars, rafael.id, "ziele_kernbotschaften", { kernbotschaften: "Eins\nZwei\n\nDrei" });
    const row = await db.clientProfileSection.findUniqueOrThrow({ where: { clientId_key: { clientId: rafael.id, key: "ziele_kernbotschaften" } } });
    expect((row.content as { kernbotschaften: string[] }).kernbotschaften).toEqual(["Eins", "Zwei", "Drei"]);
    expect(row.confirmedAt).toEqual(deps.clock.now);
    expect(row.confirmedBy).toBe(lars.id);

    // Laura ist Redakteurin: keine Bearbeitung, nur Vorschläge
    await expect(updateSection(deps, laura, rafael.id, "themen_suchbegriffe", { themen: "X" })).rejects.toThrow(ForbiddenError);
    await expect(confirmSection(deps, laura, rafael.id, "compliance")).rejects.toThrow(ForbiddenError);
    const suggestion = await suggestChange(deps, laura, rafael.id, { sectionKey: "themen_suchbegriffe", field: "themen", value: "Drohnenabwehr" });
    expect(suggestion.source).toBe("MENSCH");
    await expect(decideSuggestion(deps, laura, suggestion.id, true)).rejects.toThrow(ForbiddenError);
    await decideSuggestion(deps, lars, suggestion.id, true);
    const themen = await db.clientProfileSection.findUniqueOrThrow({ where: { clientId_key: { clientId: rafael.id, key: "themen_suchbegriffe" } } });
    expect((themen.content as { themen: string[] }).themen).toContain("Drohnenabwehr");

    // Kunden-Lead ohne CVD-Rolle: Valentin bei SAFENET
    const [valentin] = await usersByKey(db, ["valentin"] as const);
    const safenet = await clientByName(db, "SAFENET");
    await updateSection(deps, valentin, safenet.id, "ziele_kernbotschaften", { kernbotschaften: "Sicher" });
    await expect(updateSection(deps, valentin, safenet.id, "ziele_kernbotschaften", { kommunikationsziele: "Ziel" })).rejects.toThrow(ForbiddenError);
    await updateSection(deps, lukas, safenet.id, "ziele_kernbotschaften", { kommunikationsziele: "Ziel" });
    await expect(saveService(deps, valentin, safenet.id, null, { title: "PM", category: "PRESSEMITTEILUNG", targetCount: 2, periodStart: FIXED_NOW, periodEnd: FIXED_NOW })).rejects.toThrow(ForbiddenError);
    await expect(saveKpi(deps, valentin, safenet.id, null, { title: "Reichweite", target: "1 Mio.", period: "2026" })).rejects.toThrow(ForbiddenError);
    await saveKpi(deps, lukas, safenet.id, null, { title: "Reichweite", target: "1 Mio.", period: "2026" });
    expect(await db.kpi.count({ where: { clientId: safenet.id } })).toBe(1);
  });

  it("Onboarding zu Aktiv nur mit allen Pflichtabschnitten", async () => {
    const [lukas, valentin] = await usersByKey(db, ["lukas", "valentin"] as const);
    const safenet = await clientByName(db, "SAFENET");
    expect(await missingForActivation(db, safenet.id)).toEqual(["stammdaten", "ziele_kernbotschaften", "vereinbarte_leistungen", "sprecher", "themen_suchbegriffe"]);
    await expect(setClientStatus(deps, lukas, safenet.id, "AKTIV")).rejects.toThrow(/Für den Status Aktiv fehlen noch: Stammdaten, Ziele und Kernbotschaften/);

    await confirmSection(deps, lukas, safenet.id, "stammdaten");
    await updateSection(deps, valentin, safenet.id, "ziele_kernbotschaften", { kernbotschaften: "SAFENET schützt Netze" });
    await saveService(deps, lukas, safenet.id, null, { title: "Pressemitteilungen", category: "PRESSEMITTEILUNG", targetCount: 4, periodStart: FIXED_NOW, periodEnd: new Date(FIXED_NOW.getTime() + 90 * 86_400_000) });
    await updateSection(deps, valentin, safenet.id, "themen_suchbegriffe", { themen: "Netzwerksicherheit" });
    expect(await missingForActivation(db, safenet.id)).toEqual(["sprecher"]);
    // bestätigter, aber leerer Sprecherabschnitt reicht nicht
    await confirmSection(deps, valentin, safenet.id, "sprecher");
    expect(await missingForActivation(db, safenet.id)).toEqual(["sprecher"]);
    await saveSpeaker(deps, valentin, safenet.id, null, { name: "Dr. Mara Lindner", function: "Geschäftsführerin" });
    expect(await missingForActivation(db, safenet.id)).toEqual([]);
    await setClientStatus(deps, lukas, safenet.id, "AKTIV");
    expect((await db.client.findUniqueOrThrow({ where: { id: safenet.id } })).status).toBe("AKTIV");
  });

  it("Unterlagen hochladen: Ablage im SharePoint, KI-Vorschläge mit Modell und Promptversion", async () => {
    const [valentin] = await usersByKey(db, ["valentin"] as const);
    const safenet = await clientByName(db, "SAFENET");
    const result = await uploadProfileDocument(deps, valentin, safenet.id, { sectionKey: "strategie", file: await pdf("unternehmensbeschreibung.pdf") });
    expect(result.aiNotice).toBeNull();
    expect(result.suggestions).toBe(9);
    const suggestions = await db.profileSuggestion.findMany({ where: { clientId: safenet.id } });
    expect(suggestions.every((s) => s.source === "KI" && s.model?.startsWith("claude-") && s.promptVersion === "profile-from-documents@1" && s.sourceFileId === result.fileId)).toBe(true);
    const files = await listFiles(path.join(deps.storageDir, "sharepoint-mock"));
    expect(files.some((f) => f.includes(path.join("01_Kundenprofil", "Strategie_und_Ansatz", "unternehmensbeschreibung.pdf")))).toBe(true);
    // ohne Annahme ändert sich das Profil nicht
    expect(await db.clientProfileSection.count({ where: { clientId: safenet.id } })).toBe(0);
    const speaker = suggestions.find((s) => s.sectionKey === "sprecher")!;
    await decideSuggestion(deps, valentin, speaker.id, true);
    expect((await db.speaker.findMany({ where: { clientId: safenet.id } })).map((s) => s.name)).toEqual(["[Beispiel] Dr. Mara Lindner"]);
    const rejected = suggestions.find((s) => s.sectionKey === "styleguide")!;
    await decideSuggestion(deps, valentin, rejected.id, false);
    expect((await db.profileSuggestion.findUniqueOrThrow({ where: { id: rejected.id } })).status).toBe("ABGELEHNT");
    expect(await db.clientProfileSection.findUnique({ where: { clientId_key: { clientId: safenet.id, key: "styleguide" } } })).toBeNull();
  });

  it("KI erlaubt aus: Upload ohne KI-Vorschläge, keine Onboarding-Fragen, kein Lernen", async () => {
    const [lukas, valentin] = await usersByKey(db, ["lukas", "valentin"] as const);
    const safenet = await clientByName(db, "SAFENET");
    await db.client.update({ where: { id: safenet.id }, data: { aiAllowed: false } });
    const result = await uploadProfileDocument(deps, valentin, safenet.id, { sectionKey: "styleguide", file: await pdf("styleguide.pdf") });
    expect(result.suggestions).toBe(0);
    expect(result.aiNotice).toMatch(/ausgeschaltet/);
    await expect(generateOnboardingQuestions(deps, lukas, safenet.id)).rejects.toThrow(AiNotAllowedError);
  });

  it("Onboarding-Interview: Fragen zu Lücken, Antworten landen im Abschnitt, Stand bleibt erhalten", async () => {
    const [valentin, juliana] = await usersByKey(db, ["valentin", "juliana"] as const);
    const safenet = await clientByName(db, "SAFENET");
    await expect(generateOnboardingQuestions(deps, juliana, safenet.id)).rejects.toThrow(ForbiddenError);
    const questions = await generateOnboardingQuestions(deps, valentin, safenet.id);
    expect(questions.length).toBeGreaterThan(0);
    const i = questions.findIndex((q) => q.sectionKey === "tabuthemen");
    expect(i).toBeGreaterThanOrEqual(0);
    await answerOnboardingQuestion(deps, valentin, safenet.id, i, "Keine Aussagen zu Kunden");
    const profile = await loadProfile(db, safenet.id);
    expect(profile.sections.find((s) => s.def.key === "tabuthemen")!.content.themen).toEqual(["Keine Aussagen zu Kunden"]);
    expect(profile.onboarding.questions![i]!.answer).toBe("Keine Aussagen zu Kunden");
    const speakerQ = questions.findIndex((q) => q.sectionKey === "sprecher");
    await answerOnboardingQuestion(deps, valentin, safenet.id, speakerQ, "Dr. Mara Lindner");
    expect(await db.speaker.count({ where: { clientId: safenet.id } })).toBe(1);
    await expect(answerOnboardingQuestion(deps, valentin, safenet.id, i, "  ")).rejects.toThrow(DomainError);
  });

  it("Lernendes Profil: ein erledigter Text erzeugt Vorschläge, ohne KI keine", async () => {
    const covenant = await clientByName(db, "Covenant");
    const done = await db.task.findFirstOrThrow({ where: { clientId: covenant.id, title: "PM Spatenstich" } });
    const count = await learnFromFinalText(deps, done.id, null);
    expect(count).toBeGreaterThan(0);
    const suggestions = await db.profileSuggestion.findMany({ where: { clientId: covenant.id, source: "KI" } });
    expect(suggestions).toHaveLength(count);
    expect(suggestions[0]).toMatchObject({ promptVersion: "profile-from-final-text@1", sourceDocumentId: expect.any(String) });
    await db.client.update({ where: { id: covenant.id }, data: { aiAllowed: false } });
    expect(await learnFromFinalText(deps, done.id, null)).toBe(0);
  });
});
