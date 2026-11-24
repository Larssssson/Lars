import PptxGenJS from "pptxgenjs";
import { t } from "@/i18n";
import type { ReportData } from "./data";
import type { ReportMeta } from "./model";
import { articleLine, periodLine, statusLine } from "./model";

const INK = "1C1B19";
const MUTED = "6B6459";
const GREYS = ["8A8378", "A59F94", "BFB9AE", "D4CFC5", "9C9488"];

const compact = (n: number) => new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(y!, m! - 1, 15)));
};

/**
 * Executive-Version auf zwei Folien (DECISIONS D-133): echte PowerPoint-Diagramme, damit sie sich
 * nachbearbeiten lassen. Folie 1 Kennzahlen, Share of Voice, Tiers; Folie 2 Trends, Positives, Negatives.
 */
export async function buildExecutivePptx(meta: ReportMeta, data: ReportData, theme: { accent: string; font: string }): Promise<Uint8Array> {
  const d = t.reports.doc;
  const accent = theme.accent.replace(/^#/, "").toUpperCase();
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13,33 x 7,5 Zoll
  pres.title = meta.title;
  pres.company = d.preparedBy;
  const font = theme.font;
  const draft = meta.status !== "FREIGEGEBEN";

  const header = (slide: PptxGenJS.Slide, title: string) => {
    slide.background = { color: "FFFFFF" };
    slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: accent } });
    slide.addText(meta.clientName.toUpperCase(), { x: 0.5, y: 0.3, w: 8, h: 0.3, fontFace: font, fontSize: 10, bold: true, color: accent, charSpacing: 2 });
    slide.addText(title, { x: 0.5, y: 0.55, w: 12.3, h: 0.6, fontFace: font, fontSize: 26, bold: true, color: INK, fit: "shrink" });
    slide.addText(`${meta.title} · ${periodLine(meta)} · ${statusLine(meta)}`, { x: 0.5, y: 1.1, w: 12, h: 0.3, fontFace: font, fontSize: 11, color: draft ? "B3361F" : MUTED });
  };

  // Folie 1
  const s1 = pres.addSlide();
  header(s1, d.executive);
  const positiveShare = data.total ? Math.round((data.sentiment.positiv / data.total) * 100) : 0;
  const kpis = [
    { label: d.placements, value: String(data.total) },
    { label: d.reach, value: compact(data.reach) },
    { label: d.shareOfVoice, value: data.sov.length > 1 ? `${Math.round(data.sov[0]!.share * 100)} %` : "–" },
    { label: `${d.tonalitaet}: ${d.sentiments.positiv}`, value: `${positiveShare} %` },
  ];
  kpis.forEach((k, i) => {
    const x = 0.5 + i * 3.1;
    s1.addShape(pres.ShapeType.rect, { x, y: 1.6, w: 2.9, h: 0.06, fill: { color: accent } });
    s1.addText(k.value, { x, y: 1.7, w: 2.9, h: 0.7, fontFace: font, fontSize: 32, bold: true, color: accent });
    s1.addText(k.label, { x, y: 2.4, w: 2.9, h: 0.3, fontFace: font, fontSize: 11, color: MUTED });
  });
  if (data.sov.length > 1) {
    s1.addText(d.shareOfVoice, { x: 0.5, y: 3.0, w: 6, h: 0.35, fontFace: font, fontSize: 14, bold: true, color: INK });
    // waagerechte Balken laufen von unten nach oben: umgedreht, damit der Kunde oben steht
    const sov = [...data.sov].reverse();
    s1.addChart(pres.ChartType.bar, [{ name: d.articles, labels: sov.map((e) => e.name), values: sov.map((e) => e.count) }], {
      x: 0.5, y: 3.4, w: 6.1, h: 3.6, barDir: "bar", chartColors: sov.map((e, i) => (e.isClient ? accent : GREYS[i % GREYS.length]!)),
      showValue: true, dataLabelFontSize: 10, catAxisLabelFontSize: 11, valAxisHidden: true, valGridLine: { style: "none" },
      catAxisLabelFontFace: font, dataLabelFontFace: font,
    });
  }
  s1.addText(d.tiers, { x: 7.0, y: 3.0, w: 6, h: 0.35, fontFace: font, fontSize: 14, bold: true, color: INK });
  s1.addChart(pres.ChartType.bar, [{ name: d.articles, labels: [d.tier(1), d.tier(2), d.tier(3)], values: [data.tiers[1], data.tiers[2], data.tiers[3]] }], {
    x: 7.0, y: 3.4, w: 5.8, h: 3.6, barDir: "col", chartColors: [accent, GREYS[0]!, GREYS[2]!], showValue: true, dataLabelFontSize: 11,
    catAxisLabelFontSize: 11, valAxisHidden: true, valGridLine: { style: "none" }, catAxisLabelFontFace: font, dataLabelFontFace: font,
  });

  // Folie 2
  const s2 = pres.addSlide();
  header(s2, `${d.trends}, ${d.highlights}`);
  s2.addText(d.verlauf, { x: 0.5, y: 1.6, w: 6, h: 0.35, fontFace: font, fontSize: 14, bold: true, color: INK });
  const series = [{ name: meta.clientName, labels: data.trend.map((p) => monthLabel(p.month)), values: data.trend.map((p) => p.client) }];
  if (data.hasCompetitorData) series.push({ name: d.competitorSeries, labels: data.trend.map((p) => monthLabel(p.month)), values: data.trend.map((p) => p.competitors) });
  s2.addChart(pres.ChartType.bar, series, {
    x: 0.5, y: 2.0, w: 6.3, h: 4.9, barDir: "col", barGrouping: "clustered", chartColors: [accent, GREYS[1]!], showValue: true, dataLabelFontSize: 10,
    showLegend: data.hasCompetitorData, legendPos: "b", legendFontSize: 10, catAxisLabelFontSize: 11, valAxisHidden: true, valGridLine: { style: "none" },
    catAxisLabelFontFace: font, dataLabelFontFace: font, legendFontFace: font,
  });
  const bullets = (items: string[]) => (items.length ? items : [d.noneFound]).map((text) => ({ text, options: { bullet: true, breakLine: true } }));
  s2.addText(d.positives, { x: 7.2, y: 1.6, w: 5.6, h: 0.35, fontFace: font, fontSize: 14, bold: true, color: "2F8F5B" });
  s2.addText(bullets(data.positives.map(articleLine)), { x: 7.2, y: 2.0, w: 5.6, h: 2.0, fontFace: font, fontSize: 11, color: INK, valign: "top", paraSpaceAfter: 4 });
  s2.addText(d.negatives, { x: 7.2, y: 4.1, w: 5.6, h: 0.35, fontFace: font, fontSize: 14, bold: true, color: "B3361F" });
  s2.addText(bullets(data.negatives.map(articleLine)), { x: 7.2, y: 4.5, w: 5.6, h: 2.0, fontFace: font, fontSize: 11, color: INK, valign: "top", paraSpaceAfter: 4 });
  if (meta.commentary?.trim()) {
    s2.addNotes(meta.commentary.trim());
  }
  s2.addText(d.source, { x: 0.5, y: 7.05, w: 12, h: 0.3, fontFace: font, fontSize: 9, color: MUTED });

  const buffer = (await pres.write({ outputType: "nodebuffer" })) as Buffer;
  return new Uint8Array(buffer);
}
