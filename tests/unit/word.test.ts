import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildFilledContent, type FormatBlock } from "@/lib/domain/documents/template";
import { buildDocx } from "@/lib/domain/documents/word-export";
import { importDocx } from "@/lib/domain/documents/word-import";
import { blockTexts, type JSONNode } from "@/lib/editor/content";
import { seedFormats } from "@/prisma/seed-data";

const pmBlocks = seedFormats.find((f) => f.key === "PRESSEMITTEILUNG")!.blocks as FormatBlock[];
const template = async () => ({
  logo: { data: new Uint8Array(await readFile("fixtures/templates/rp_logo_placeholder.png")), type: "png" as const, width: 120, height: 48 },
  color: "5BB5E5",
  font: "Arial",
});

const content = buildFilledContent(pmBlocks, {
  headline: "Covenant baut in Sachsen",
  ortsmarke: "Leipzig, 20. Oktober 2026",
  lead: "Covenant errichtet einen Standort.",
  haupttext: "Erster Absatz.\n\nZweiter Absatz.",
  zitat: "„Gut für Sachsen“, sagt Dr. Anna Weber.",
}) as JSONNode;

describe("Word-Export und -Import (BRIEFING 7.3)", () => {
  it("erzeugt eine gültige .docx-Datei ohne Änderungsmarkierungen", async () => {
    const withChange: JSONNode = JSON.parse(JSON.stringify(content));
    withChange.content![1]!.content![0]!.content!.push({ type: "text", text: "GELÖSCHT", marks: [{ type: "deletion" }] });
    const docx = await buildDocx({ content: withChange, format: "PRESSEMITTEILUNG", title: "PM", template: await template() });
    expect(Buffer.from(docx.slice(0, 2)).toString()).toBe("PK");
    const back = await importDocx(docx, pmBlocks);
    expect(JSON.stringify(back)).not.toContain("GELÖSCHT");
  });

  it("ein exportierter Text kommt beim Import in dieselben Bausteine zurück", async () => {
    const docx = await buildDocx({ content, format: "PRESSEMITTEILUNG", title: "PM", template: await template() });
    const texts = Object.fromEntries(blockTexts(await importDocx(docx, pmBlocks)).map((b) => [b.key, b.text]));
    expect(texts).toMatchObject({
      headline: "Covenant baut in Sachsen",
      ortsmarke: "Leipzig, 20. Oktober 2026",
      lead: "Covenant errichtet einen Standort.",
      haupttext: "Erster Absatz.\nZweiter Absatz.",
      zitat: "„Gut für Sachsen“, sagt Dr. Anna Weber.",
      boilerplate: "",
    });
  });

  it("Bausteinnamen erscheinen bei Q&A, nicht bei Pressemitteilungen, und werden beim Import übersprungen", async () => {
    const qaBlocks = seedFormats.find((f) => f.key === "QA")!.blocks as FormatBlock[];
    const qa = buildFilledContent(qaBlocks, { stand: "20.10.2026", verwendung: "intern", fragen: "Warum Sachsen?\n\nWegen der Fachkräfte." }) as JSONNode;
    const docx = await buildDocx({ content: qa, format: "QA", title: "Q&A", template: await template() });
    const texts = blockTexts(await importDocx(docx, qaBlocks));
    expect(texts.find((b) => b.key === "fragen")?.text).toBe("Warum Sachsen?\nWegen der Fachkräfte.");
    expect(texts.find((b) => b.key === "stand")?.text).toBe("20.10.2026");
  });
});

describe("Import fremder Word-Dateien", () => {
  it("erste Überschrift wird Headline, der Rest Haupttext mit Fett und Listen", async () => {
    const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
    const doc = new Document({
      numbering: { config: [{ reference: "b", levels: [{ level: 0, format: "bullet", text: "•" }] }] },
      sections: [
        {
          children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Neue Halle in Leipzig")] }),
            new Paragraph({ children: [new TextRun("Der Bau "), new TextRun({ text: "beginnt", bold: true }), new TextRun(" 2027.")] }),
            new Paragraph({ numbering: { reference: "b", level: 0 }, children: [new TextRun("Punkt eins")] }),
            new Paragraph({ numbering: { reference: "b", level: 0 }, children: [new TextRun("Punkt zwei")] }),
          ],
        },
      ],
    });
    const imported = await importDocx(new Uint8Array(await Packer.toBuffer(doc)), pmBlocks);
    const texts = Object.fromEntries(blockTexts(imported).map((b) => [b.key, b.text]));
    expect(texts.headline).toBe("Neue Halle in Leipzig");
    expect(texts.haupttext).toBe("Der Bau beginnt 2027.\nPunkt eins\nPunkt zwei");
    const body = imported.content!.find((b) => b.attrs?.key === "haupttext")!;
    expect(JSON.stringify(body)).toContain('"bold"');
    expect(body.content!.map((n) => n.type)).toEqual(["paragraph", "bulletList"]);
  });
});
