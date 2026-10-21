import { beforeEach, describe, expect, it } from "vitest";
import { AiNotAllowedError } from "@/lib/ai/errors";
import { requestApproval } from "@/lib/domain/approvals/service";
import { acceptInsertion, createInsertion, discardInsertion, suggestHeadlines, suggestLead, suggestQuote } from "@/lib/domain/documents/ai-blocks";
import { dismissFinding, latestCheck, markFindingDone, openFindingCount, runCheck } from "@/lib/domain/documents/check";
import { saveContent } from "@/lib/domain/documents/service";
import { DomainError } from "@/lib/domain/errors";
import { ForbiddenError } from "@/lib/domain/permissions";
import type { JSONNode } from "@/lib/editor/content";
import { createPrismaClient } from "@/lib/db";
import { clientByName, resetAndSeed, testDeps, usersByKey, type TestDeps } from "./helpers";

const db = createPrismaClient();
let deps: TestDeps;

beforeEach(async () => {
  await resetAndSeed(db);
  deps = await testDeps(db);
});

async function taskByTitle(title: string) {
  return db.task.findFirstOrThrow({ where: { title }, include: { document: true } });
}

/** Text eines Bausteins im gespeicherten JSON ersetzen; optional mit Markierungen. */
function withBlock(content: JSONNode, key: string, text: string, marks?: JSONNode["marks"]): JSONNode {
  return {
    ...content,
    content: content.content!.map((block) =>
      block.attrs?.key === key ? { ...block, content: [{ type: "paragraph", content: text ? [{ type: "text", text, ...(marks ? { marks } : {}) }] : [] }] } : block,
    ),
  };
}

describe("Prüfung (BRIEFING 7.4)", () => {
  it("Schnellprüfung: Struktur regelbasiert, Compliance und Faktentreue mit KI, Fundstellen, keine Resonanz", async () => {
    const [lukas] = await usersByKey(db, ["lukas"] as const);
    const pm = await taskByTitle("PM Standortentscheidung");
    const run = await runCheck(deps, lukas, pm.id, "SCHNELL");
    expect(run).toMatchObject({ mode: "SCHNELL", strictness: "NORMAL", model: expect.stringMatching(/^claude-/), promptVersion: "check@1" });
    const check = (await latestCheck(db, pm.document!.id))!;
    expect(check.scores.resonance).toBeNull();
    expect(new Set(check.findings.map((f) => f.category))).toEqual(new Set(["STRUKTUR", "COMPLIANCE", "FAKTENTREUE"]));
    expect(check.findings.find((f) => f.category === "STRUKTUR" && f.message === "Ortsmarke und Datum fehlt")).toBeTruthy();
    const fact = check.findings.find((f) => f.category === "FAKTENTREUE")!;
    expect(fact).toMatchObject({ severity: "KRITISCH", confidence: "HOCH", anchor: { blockKey: "lead", quote: "600 neue Arbeitsplätze" } });
    // Konformität: KI-Wert minus Abzug für Strukturhinweise
    expect(check.scores.conformity).toBeLessThan(58);
    expect(check.scores.warnings).toEqual([]);
    // die geprüfte Fassung ist eine Version
    expect(check.version.number).toBeGreaterThan(0);
  });

  it("Vollanalyse: alle Prüfschritte, Medienresonanz, Profilwarnungen", async () => {
    const [lars] = await usersByKey(db, ["lars"] as const);
    const pm = await taskByTitle("PM Standortentscheidung");
    await runCheck(deps, lars, pm.id, "VOLL");
    const check = (await latestCheck(db, pm.document!.id))!;
    expect(check.scores.resonance).toBe(66);
    expect(new Set(check.findings.map((f) => f.category))).toEqual(new Set(["STRUKTUR", "COMPLIANCE", "FAKTENTREUE", "STYLEGUIDE", "TONE", "RESONANZ", "ERWEITERUNG", "DISTRIBUTION"]));
    expect(check.findings.find((f) => f.category === "TONE")).toMatchObject({ anchor: { wholeText: true }, suggestion: "ZITAT" });
    expect(check.findings.find((f) => f.category === "RESONANZ")).toMatchObject({ suggestion: "HEADLINE" });

    // Ground A: Compliance 400 Tage alt, Profilwarnung oben (Statement zur Förderung)
    const statement = await taskByTitle("Statement zur Förderung");
    await runCheck(deps, lars, statement.id, "VOLL");
    const warned = (await latestCheck(db, statement.document!.id))!;
    expect(warned.scores.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/^Compliance-Regeln sind 13 Monate alt$/)]));
    // Fundstellen der Beispielantwort stehen nicht im Statement: diese Hinweise entfallen
    expect(warned.findings.some((f) => (f.anchor as { quote?: string }).quote === "600 neue Arbeitsplätze")).toBe(false);
  });

  it("Erledigt, Verwerfen und Verwerfungsregel pro Kunde", async () => {
    const [lukas] = await usersByKey(db, ["lukas"] as const);
    const pm = await taskByTitle("PM Standortentscheidung");
    await runCheck(deps, lukas, pm.id, "SCHNELL");
    let check = (await latestCheck(db, pm.document!.id))!;
    const total = check.findings.length;
    const [first, second] = check.findings.filter((f) => f.category !== "STRUKTUR");
    await markFindingDone(deps, lukas, first!.id);
    await dismissFinding(deps, lukas, second!.id, { reason: "Kunde hat zugestimmt", createRule: true });
    expect(await openFindingCount(db, pm.document!.id)).toBe(total - 2);
    check = (await latestCheck(db, pm.document!.id))!;
    expect(check.findings.find((f) => f.id === second!.id)).toMatchObject({ status: "VERWORFEN", dismissReason: "Kunde hat zugestimmt" });
    const rules = await db.dismissalRule.findMany({ where: { clientId: pm.clientId } });
    expect(rules).toHaveLength(1);

    // die nächste Prüfung unterdrückt den gleichartigen Hinweis
    await runCheck(deps, lukas, pm.id, "SCHNELL");
    check = (await latestCheck(db, pm.document!.id))!;
    expect(check.findings.some((f) => f.message === second!.message)).toBe(false);
    expect(check.findings.some((f) => f.message === first!.message)).toBe(true);
  });

  it("KI erlaubt aus oder KI nicht erreichbar: nur Strukturprüfung mit Hinweis", async () => {
    const [lukas] = await usersByKey(db, ["lukas"] as const);
    const pm = await taskByTitle("PM Standortentscheidung");
    await db.client.update({ where: { id: pm.clientId }, data: { aiAllowed: false } });
    const off = await runCheck(deps, lukas, pm.id, "VOLL");
    expect(off.model).toBeNull();
    let check = (await latestCheck(db, pm.document!.id))!;
    expect(check.findings.every((f) => f.category === "STRUKTUR")).toBe(true);
    expect(check.scores.aiNotice).toMatch(/ausgeschaltet/);
    expect(check.scores.resonance).toBeNull();

    await db.client.update({ where: { id: pm.clientId }, data: { aiAllowed: true } });
    deps.ai = { kind: "mock", complete: async () => { throw new Error("weg"); }, health: async () => ({ ok: false, detail: "" }) } as never;
    await runCheck(deps, lukas, pm.id, "SCHNELL");
    check = (await latestCheck(db, pm.document!.id))!;
    expect(check.scores.aiNotice).toMatch(/nicht erreichbar/);
  });

  it("Strenge locker unterdrückt einfache Strukturhinweise", async () => {
    const [lukas] = await usersByKey(db, ["lukas"] as const);
    const pm = await taskByTitle("PM Standortentscheidung");
    await db.client.update({ where: { id: pm.clientId }, data: { checkStrictness: "LOCKER", aiAllowed: false } });
    const run = await runCheck(deps, lukas, pm.id, "SCHNELL");
    expect(run.strictness).toBe("LOCKER");
    const check = (await latestCheck(db, pm.document!.id))!;
    expect(check.findings.every((f) => f.severity !== "HINWEIS")).toBe(true);
  });
});

describe("KI-Bausteine (BRIEFING 8.2)", () => {
  it("Vorschläge, Markierung, Sperre der Freigabeanfrage bis zur Übernahme", async () => {
    const [robin, laura] = await usersByKey(db, ["robin", "laura"] as const);
    const qa = await taskByTitle("Q&A Standort aktualisieren");
    const headlines = await suggestHeadlines(deps, robin, qa.id);
    expect(headlines.options).toHaveLength(3);
    expect(headlines.promptVersion).toBe("headlines@1");
    await expect(suggestHeadlines(deps, laura, qa.id)).rejects.toThrow(ForbiddenError);

    const lead = await suggestLead(deps, robin, qa.id);
    expect(lead.options[0]).toContain("450");
    const speaker = await db.speaker.findFirstOrThrow({ where: { clientId: qa.clientId } });
    const quote = await suggestQuote(deps, robin, qa.id, speaker.id);
    expect(quote.quoteNeedsClientApproval).toBe(true);

    const insertion = await createInsertion(deps, robin, qa.id, { kind: "ZITAT", model: quote.model, promptVersion: quote.promptVersion });
    const marked = withBlock(qa.document!.content as JSONNode, "fragen", quote.options[0]!, [{ type: "aiInsertion", attrs: { id: insertion.id, kind: "ZITAT" } }]);
    await saveContent(deps, robin, qa.id, marked);
    const saved = await db.document.findUniqueOrThrow({ where: { id: qa.document!.id } });
    expect(JSON.stringify(saved.content)).toContain(insertion.id);

    await expect(requestApproval(deps, robin, qa.id, { confirmWithoutCheck: true })).rejects.toThrow(/KI-Baustein/);
    await acceptInsertion(deps, robin, qa.id, insertion.id);
    const accepted = await db.aiInsertion.findUniqueOrThrow({ where: { id: insertion.id } });
    expect(accepted).toMatchObject({ status: "ANGENOMMEN", acceptedBy: robin.id, model: expect.stringMatching(/^claude-/), promptVersion: "quote@1" });
    // nach der Übernahme entfernt das Speichern die Markierung
    await saveContent(deps, robin, qa.id, marked);
    expect(JSON.stringify((await db.document.findUniqueOrThrow({ where: { id: qa.document!.id } })).content)).not.toContain("aiInsertion");
    await requestApproval(deps, robin, qa.id, { confirmWithoutCheck: true });
    expect((await db.task.findUniqueOrThrow({ where: { id: qa.id } })).status).toBe("FREIGABE_ANGEFRAGT");
  });

  it("Gelöschte Bausteine gelten als verworfen, fremde Markierungen werden entfernt", async () => {
    const [robin] = await usersByKey(db, ["robin"] as const);
    const qa = await taskByTitle("Q&A Standort aktualisieren");
    const content = qa.document!.content as JSONNode;
    const a = await createInsertion(deps, robin, qa.id, { kind: "HEADLINE", model: "m", promptVersion: "headlines@1" });
    const b = await createInsertion(deps, robin, qa.id, { kind: "LEAD", model: "m", promptVersion: "lead@1" });
    // a steht im Text, b nicht; dazu eine erfundene Markierung ohne Datensatz
    const forged = withBlock(withBlock(content, "fragen", "KI-Text", [{ type: "aiInsertion", attrs: { id: a.id, kind: "HEADLINE" } }]), "stand", "Stand", [{ type: "aiInsertion", attrs: { id: "00000000-0000-4000-8000-000000000000", kind: "SONSTIGES" } }]);
    await saveContent(deps, robin, qa.id, forged);
    expect((await db.aiInsertion.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("OFFEN");
    expect((await db.aiInsertion.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("VERWORFEN");
    expect(JSON.stringify((await db.document.findUniqueOrThrow({ where: { id: qa.document!.id } })).content)).not.toContain("00000000-0000-4000-8000-000000000000");
    await discardInsertion(deps, robin, qa.id, a.id);
    expect((await db.aiInsertion.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("VERWORFEN");
  });

  it("KI erlaubt aus sperrt Bausteine serverseitig", async () => {
    const [robin] = await usersByKey(db, ["robin"] as const);
    const qa = await taskByTitle("Q&A Standort aktualisieren");
    const covenant = await clientByName(db, "Covenant");
    await db.client.update({ where: { id: covenant.id }, data: { aiAllowed: false } });
    await expect(suggestHeadlines(deps, robin, qa.id)).rejects.toThrow(AiNotAllowedError);
    await expect(createInsertion(deps, robin, qa.id, { kind: "HEADLINE", model: "m", promptVersion: "p" })).rejects.toThrow(DomainError);
  });
});
