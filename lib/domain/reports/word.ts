import { chromium } from "playwright";
import { AlignmentType, BorderStyle, Document, ImageRun, Packer, PageBreak, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { t } from "@/i18n";
import type { ReportMeta, ReportSection } from "./model";
import { periodLine, statusLine } from "./model";
import { TEMPLATES } from "./templates";

/** SVG-Diagramme als PNG (Word kann kein SVG zuverlässig darstellen), gerendert mit Chromium wie der PDF-Export. */
export async function svgsToPng(svgs: string[]): Promise<{ data: Uint8Array; width: number; height: number }[]> {
  if (!svgs.length) return [];
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    const out: { data: Uint8Array; width: number; height: number }[] = [];
    for (const svg of svgs) {
      await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff">${svg}</body></html>`);
      const el = await page.$("svg");
      const box = (await el!.boundingBox())!;
      out.push({ data: new Uint8Array(await el!.screenshot({ type: "png" })), width: Math.round(box.width), height: Math.round(box.height) });
    }
    return out;
  } finally {
    await browser.close();
  }
}

const FONT_SIZE = 21; // halbe Punkte

export async function buildReportDocx(meta: ReportMeta, sections: ReportSection[], notes: string[], theme: { accent: string; font: string; logo: { data: Uint8Array; type: "png" | "jpg" } | null }, emptyText: string | null): Promise<Uint8Array> {
  const accent = theme.accent.replace(/^#/, "").toUpperCase();
  const tpl = TEMPLATES[meta.template];
  const draft = meta.status !== "FREIGEGEBEN";
  const charts = emptyText ? [] : await svgsToPng(sections.filter((s) => s.chart).map((s) => s.chart!.svg));
  let chartIndex = 0;
  const children: (Paragraph | Table)[] = [];

  if (theme.logo) {
    children.push(new Paragraph({ children: [new ImageRun({ type: theme.logo.type, data: theme.logo.data, transformation: { width: 140, height: 40 } })], spacing: { after: 200 } }));
  }
  children.push(
    new Paragraph({ children: [new TextRun({ text: meta.clientName.toUpperCase(), bold: true, size: 16, color: accent, characterSpacing: 40 })] }),
    new Paragraph({ children: [new TextRun({ text: meta.title, bold: true, size: tpl.cover ? 52 : 40 })], spacing: { after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: periodLine(meta), color: "6B6459" })] }),
    new Paragraph({ children: [new TextRun({ text: statusLine(meta), bold: draft, color: draft ? "B3361F" : "2F6B45", size: 18 })], spacing: { after: 300 } }),
  );
  if (tpl.cover) children.push(new Paragraph({ children: [new PageBreak()] }));

  if (emptyText) children.push(new Paragraph({ children: [new TextRun(emptyText)] }));
  for (const s of emptyText ? [] : sections) {
    if (s.block === "medienliste" && tpl.cover) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: s.title, bold: true, size: 26 })],
        spacing: { before: 280, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "1C1B19", space: 2 } },
        keepNext: true,
      }),
    );
    if (s.stats) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
          rows: [
            new TableRow({
              children: s.stats.map(
                (x) =>
                  new TableCell({
                    borders: { top: { style: BorderStyle.SINGLE, size: 18, color: accent }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: x.value, bold: true, size: tpl.style === "management" ? 52 : 36, color: tpl.style === "management" ? accent : undefined })] }),
                      new Paragraph({ children: [new TextRun({ text: x.label, size: 16, color: "6B6459" })] }),
                    ],
                  }),
              ),
            }),
          ],
        }),
      );
    }
    for (const p of s.paragraphs ?? []) children.push(new Paragraph({ children: [new TextRun(p)], spacing: { before: 100, after: 100 } }));
    if (s.chart) {
      const img = charts[chartIndex++]!;
      const width = 600;
      children.push(new Paragraph({ children: [new ImageRun({ type: "png", data: img.data, transformation: { width, height: Math.round((img.height / img.width) * width) }, altText: { name: s.title, description: s.chart.alt, title: s.title } })], spacing: { after: 120 } }));
    }
    if (s.highlights) {
      const list = (title: string, items: string[], color: string) => [
        new Paragraph({ children: [new TextRun({ text: title, bold: true, color })], spacing: { before: 120 } }),
        ...(items.length ? items.map((i) => new Paragraph({ text: i, bullet: { level: 0 } })) : [new Paragraph({ children: [new TextRun({ text: t.reports.doc.noneFound, color: "6B6459" })] })]),
      ];
      children.push(...list(t.reports.doc.positives, s.highlights.positives, "2F8F5B"), ...list(t.reports.doc.negatives, s.highlights.negatives, "B3361F"));
    }
    if (s.table && !(s.chart && tpl.style !== "bericht")) {
      const widths = s.table.widths ?? s.table.head.map(() => Math.floor(100 / s.table!.head.length));
      const cell = (text: string, i: number, header: boolean) =>
        new TableCell({
          width: { size: widths[i] ?? 10, type: WidthType.PERCENTAGE },
          shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: "F1EDE6" } : undefined,
          children: [new Paragraph({ children: [new TextRun({ text, bold: header, size: 17 })] })],
        });
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({ tableHeader: true, children: s.table.head.map((h, i) => cell(h, i, true)) }), ...s.table.rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i, false)) }))],
        }),
      );
    }
  }
  children.push(new Paragraph({ children: [new TextRun({ text: notes.join(" "), size: 16, color: "6B6459" })], spacing: { before: 400 }, alignment: AlignmentType.LEFT }));

  const doc = new Document({
    styles: { default: { document: { run: { font: theme.font, size: FONT_SIZE } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children }],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
