import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { dismissalPattern, resolveAnchor } from "@/lib/domain/documents/check";
import { normalizeField } from "@/lib/domain/clients/profile";
import { structureFindings } from "@/lib/domain/documents/structure-check";
import type { BlockText, JSONNode } from "@/lib/editor/content";
import { aiInsertionIds, baseExtensions } from "@/lib/editor/extensions";
import { aiRanges, findInBlock, insertionTarget, listAiInsertions } from "@/lib/editor/positions";

const PM_RULES = { minChars: 2000, maxChars: 4500, firstQuoteWithinChars: 1500, requiresNumber: true, leadAnswersWQuestions: true };
const block = (key: string, text: string, required = true): BlockText => ({ key, label: key === "ortsmarke" ? "Ortsmarke und Datum" : key, required, text });
const messages = (f: { message: string }[]) => f.map((x) => x.message);

describe("Strukturprüfung ohne KI (BRIEFING 7.4)", () => {
  it("meldet leere Pflichtbausteine mit Fundstelle am Baustein", () => {
    const findings = structureFindings({ blocks: [block("headline", "Titel"), block("ortsmarke", ""), block("sperrfrist", "", false)], rules: {} });
    expect(messages(findings)).toEqual(["Ortsmarke und Datum fehlt"]);
    expect(findings[0]).toMatchObject({ category: "STRUKTUR", severity: "WICHTIG", anchor: { blockKey: "ortsmarke" } });
  });

  it("prüft Länge, Zahl und Zitat innerhalb der ersten 1.500 Zeichen", () => {
    const long = "Wort ".repeat(400); // 2.000 Zeichen ohne Zahl und Zitat
    const findings = structureFindings({ blocks: [block("lead", "Covenant baut heute in Leipzig."), block("haupttext", long), block("zitat", "")], rules: PM_RULES });
    expect(messages(findings)).toContain("Noch kein Zitat nach 1.500 Zeichen");
    expect(messages(findings)).toContain("Der Text enthält keine Zahl.");
    expect(messages(findings)).toContain("zitat fehlt");

    const ok = structureFindings({
      blocks: [block("lead", "Covenant baut ab 2028 in Leipzig 450 Arbeitsplätze."), block("zitat", "„Gut“, sagt Weber."), block("haupttext", long)],
      rules: PM_RULES,
    });
    expect(messages(ok)).toEqual([]);
  });

  it("zählt Ortsmarke, Boilerplate und Pressekontakt nicht als Inhalt", () => {
    const findings = structureFindings({ blocks: [block("ortsmarke", "Leipzig, 20. Oktober 2026"), block("lead", "Covenant baut heute in Leipzig.")], rules: { requiresNumber: true } });
    expect(messages(findings)).toContain("Der Text enthält keine Zahl.");
  });

  it("prüft den Lead auf Wann und Wo", () => {
    const findings = structureFindings({ blocks: [block("ortsmarke", ""), block("lead", "Covenant baut einen Standort.")], rules: { leadAnswersWQuestions: true } });
    expect(messages(findings)).toEqual(expect.arrayContaining(["Der Lead sagt nicht, wann es passiert.", "Der Lead sagt nicht, wo es passiert."]));
    const withPlace = structureFindings({ blocks: [block("ortsmarke", "Leipzig, 20.10.2026"), block("lead", "Covenant baut am Montag in Leipzig.")], rules: { leadAnswersWQuestions: true } });
    expect(withPlace).toEqual([]);
  });

  it("Höchstlänge, Sprecherliste und unbeantwortete Fragen", () => {
    expect(messages(structureFindings({ blocks: [block("text", "x".repeat(1300))], rules: { maxChars: 1200 } }))).toEqual(["Der Text hat 1300 Zeichen, vorgesehen sind höchstens 1200."]);
    const speaker = structureFindings({ blocks: [block("sprecher", "Max Muster, Vorstand")], rules: { speakerInSpeakerList: true }, speakers: ["[Beispiel] Tobias Klein"] });
    expect(messages(speaker)).toEqual(["Der Sprecher steht nicht in der Sprecherliste des Kunden."]);
    expect(structureFindings({ blocks: [block("sprecher", "[Beispiel] Tobias Klein, Pressesprecher")], rules: { speakerInSpeakerList: true }, speakers: ["[Beispiel] Tobias Klein"] })).toEqual([]);
    const qa = structureFindings({ blocks: [block("fragen", "Warum Sachsen?\nWeil es passt.\nWann geht es los?")], rules: { everyQuestionAnswered: true } });
    expect(messages(qa)).toEqual(["Die Frage „Wann geht es los?“ hat keine Antwort."]);
  });

  it("Strenge locker blendet einfache Hinweise aus", () => {
    const blocks = [block("lead", "Covenant baut einen Standort."), block("ortsmarke", "")];
    expect(structureFindings({ blocks, rules: { leadAnswersWQuestions: true }, strictness: "NORMAL" }).length).toBe(3);
    expect(messages(structureFindings({ blocks, rules: { leadAnswersWQuestions: true }, strictness: "LOCKER" }))).toEqual(["Ortsmarke und Datum fehlt"]);
  });
});

describe("Fundstellen und Verwerfungsregeln", () => {
  const blocks = [block("lead", "Covenant plant 600 neue  Arbeitsplätze."), block("haupttext", "Der Bau beginnt 2027.")];

  it("prüft Fundstellen und korrigiert den Baustein, verwirft unauffindbare", () => {
    expect(resolveAnchor({ blockKey: "lead", quote: "600 neue Arbeitsplätze" }, blocks)).toEqual({ blockKey: "lead", quote: "600 neue Arbeitsplätze" });
    expect(resolveAnchor({ blockKey: "lead", quote: "Der Bau beginnt" }, blocks)).toEqual({ blockKey: "haupttext", quote: "Der Bau beginnt" });
    expect(resolveAnchor({ blockKey: "lead", quote: "steht nirgends" }, blocks)).toBeNull();
    expect(resolveAnchor({ wholeText: true }, blocks)).toEqual({ wholeText: true });
  });

  it("gleichartige Hinweise haben dasselbe Muster", () => {
    expect(dismissalPattern("Die Zahl 600 widerspricht dem Factsheet.")).toBe(dismissalPattern("Die Zahl 450 widerspricht dem Factsheet!"));
    expect(dismissalPattern("Ortsmarke fehlt")).not.toBe(dismissalPattern("Zitat fehlt"));
  });

  it("Profilfelder aus Formularen: Listen zeilenweise, Fakten mit Quelle und Datum", () => {
    expect(normalizeField("list", " a \n\n b ")).toEqual(["a", "b"]);
    expect(normalizeField("facts", "450 Arbeitsplätze | Factsheet | 2026-09-01\n120 Mio. Euro")).toEqual([
      { text: "450 Arbeitsplätze", source: "Factsheet", date: "2026-09-01" },
      { text: "120 Mio. Euro" },
    ]);
  });
});

describe("Positionen im Editor (KI-Bausteine, Sprung zur Fundstelle)", () => {
  const schema = getSchema(baseExtensions());
  const json: JSONNode = {
    type: "doc",
    content: [
      { type: "templateBlock", attrs: { key: "headline", label: "Headline", required: true }, content: [{ type: "paragraph" }] },
      {
        type: "templateBlock",
        attrs: { key: "lead", label: "Lead", required: true },
        content: [{ type: "paragraph", content: [{ type: "text", text: "Covenant plant " }, { type: "text", text: "600", marks: [{ type: "deletion", attrs: { userId: "x", userName: "X", at: "" } }] }, { type: "text", text: "450 Stellen." }] }],
      },
      {
        type: "templateBlock",
        attrs: { key: "zitat", label: "Zitat", required: true },
        content: [{ type: "paragraph", content: [{ type: "text", text: "„Gut“", marks: [{ type: "aiInsertion", attrs: { id: "a1", kind: "ZITAT" } }] }, { type: "text", text: " sagt sie." }] }],
      },
    ],
  };
  const doc = PMNode.fromJSON(schema, json);

  it("findet Zitate im Baustein ohne gelöschten Text", () => {
    const range = findInBlock(doc, "lead", "plant 450 Stellen");
    expect(range).not.toBeNull();
    expect(doc.textBetween(range!.from, range!.to)).toBe("plant 600450 Stellen");
    expect(findInBlock(doc, "lead", "gibt es nicht")).toBeNull();
  });

  it("listet KI-Bausteine mit Bereich und erkennt ihre IDs im JSON", () => {
    const blocks = listAiInsertions(doc);
    expect(blocks).toEqual([expect.objectContaining({ id: "a1", kind: "ZITAT", text: "„Gut“" })]);
    expect(aiRanges(doc, "a1")).toHaveLength(1);
    expect([...aiInsertionIds(json)]).toEqual(["a1"]);
  });

  it("fügt ohne Cursor in den passenden Baustein ein, mit Markierung anstelle der Markierung", () => {
    const empty = { from: 0, to: 0, empty: true, focused: false };
    const target = insertionTarget(doc, empty, "HEADLINE");
    expect(doc.resolve(target.from).parent.type.name).toBe("paragraph");
    expect(doc.resolve(target.from).node(1).attrs.key).toBe("headline");
    const lead = insertionTarget(doc, empty, "LEAD");
    expect(doc.textBetween(lead.from, lead.to)).toBe("Covenant plant 600450 Stellen.");
    // Markierung im Lead: ein Zitat ersetzt sie, eine Headline geht trotzdem in den Baustein Headline
    expect(insertionTarget(doc, { from: 20, to: 25, empty: false, focused: true }, "ZITAT")).toEqual({ from: 20, to: 25 });
    expect(insertionTarget(doc, { from: 20, to: 25, empty: false, focused: true }, "HEADLINE")).toEqual(target);
    expect(insertionTarget(doc, { from: 20, to: 20, empty: true, focused: true }, "ZITAT")).toEqual({ from: 20, to: 20 });
  });
});
