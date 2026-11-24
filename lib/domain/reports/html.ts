import { t } from "@/i18n";
import type { ReportMeta, ReportSection } from "./model";
import { periodLine, statusLine } from "./model";
import { TEMPLATES } from "./templates";

export type ReportTheme = { accent: string; font: string; logoDataUrl: string | null };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function section(s: ReportSection, style: string): string {
  const parts: string[] = [`<section class="block block-${s.block}"><h2>${esc(s.title)}</h2>`];
  if (s.stats) parts.push(`<div class="stats">${s.stats.map((x) => `<div class="stat"><b>${esc(x.value)}</b><span>${esc(x.label)}</span></div>`).join("")}</div>`);
  if (s.paragraphs) parts.push(s.paragraphs.map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join(""));
  if (s.chart) parts.push(`<figure class="chart" aria-label="${esc(s.chart.alt)}">${s.chart.svg}</figure>`);
  if (s.highlights) {
    const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : `<p class="muted">${esc(t.reports.doc.noneFound)}</p>`);
    parts.push(`<div class="hl"><div class="pos"><h3>${esc(t.reports.doc.positives)}</h3>${list(s.highlights.positives)}</div><div class="neg"><h3>${esc(t.reports.doc.negatives)}</h3>${list(s.highlights.negatives)}</div></div>`);
  }
  if (s.table && !(s.chart && style !== "bericht")) {
    const cols = s.table.widths ? `<colgroup>${s.table.widths.map((w) => `<col style="width:${w}%">`).join("")}</colgroup>` : "";
    parts.push(`<table>${cols}<thead><tr>${s.table.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${s.table.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
  }
  parts.push("</section>");
  return parts.join("");
}

/** Vollständiges HTML für Vorschau und PDF (A4). Gestaltung je Vorlage, Akzentfarbe und Schrift aus der RP-Vorlage. */
export function buildReportHtml(meta: ReportMeta, sections: ReportSection[], notes: string[], theme: ReportTheme, emptyText: string | null): string {
  const tpl = TEMPLATES[meta.template];
  const accent = theme.accent.startsWith("#") ? theme.accent : `#${theme.accent}`;
  const draft = meta.status !== "FREIGEGEBEN";
  const logo = theme.logoDataUrl ? `<img class="logo" src="${theme.logoDataUrl}" alt="">` : `<span class="wordmark">${esc(t.reports.doc.preparedBy)}</span>`;
  const head = `<header class="head">${logo}<div class="status ${draft ? "draft" : "ok"}">${esc(statusLine(meta))}</div></header>`;
  const titleBlock = tpl.cover
    ? `<div class="cover">${logo}<p class="kicker">${esc(meta.clientName)}</p><h1>${esc(meta.title)}</h1><p class="period">${esc(periodLine(meta))}</p><p class="status ${draft ? "draft" : "ok"}">${esc(statusLine(meta))}</p></div>`
    : `${head}<p class="kicker">${esc(meta.clientName)}</p><h1>${esc(meta.title)}</h1><p class="period">${esc(periodLine(meta))}</p>`;
  const body = emptyText ? `<p class="empty">${esc(emptyText)}</p>` : sections.map((s) => section(s, tpl.style)).join("");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(meta.title)}</title><style>
@page { size: A4; margin: 16mm 16mm 18mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #1c1b19; font-family: ${JSON.stringify(theme.font)}, Inter, Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; background: #fff; }
.sheet { max-width: 178mm; margin: 0 auto; padding: 8mm 0; }
h1 { font-size: 22pt; line-height: 1.15; margin: 2mm 0 1mm; font-weight: 600; }
h2 { font-size: 13pt; margin: 0 0 3mm; padding-bottom: 1.5mm; border-bottom: 1.5px solid #1c1b19; font-weight: 600; }
h3 { font-size: 10.5pt; margin: 0 0 1.5mm; }
.kicker { text-transform: uppercase; letter-spacing: .14em; font-size: 8pt; font-weight: 600; color: ${accent}; margin: 0; }
.period { color: #6b6459; margin: 0 0 6mm; }
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6mm; }
.logo { max-height: 12mm; max-width: 50mm; }
.wordmark { font-weight: 600; letter-spacing: .02em; }
.status { font-size: 8.5pt; padding: 1mm 2.5mm; border-radius: 99px; }
.status.draft { background: #fdecea; color: #b3361f; font-weight: 600; }
.status.ok { background: #e8f3ec; color: #2f6b45; }
.block { margin: 0 0 8mm; break-inside: avoid; }
.block-medienliste, .block-topArtikel { break-inside: auto; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-bottom: 3mm; }
.stat { border-top: 3px solid ${accent}; padding-top: 2mm; }
.stat b { display: block; font-size: 18pt; line-height: 1.1; }
.stat span { color: #6b6459; font-size: 8.5pt; }
.chart { margin: 0; } .chart svg { max-width: 100%; height: auto; }
table { width: 100%; border-collapse: collapse; font-size: 8.8pt; margin-top: 2mm; }
th { text-align: left; font-weight: 600; border-bottom: 1px solid #1c1b19; padding: 1.2mm 1.5mm; }
td { border-bottom: 1px solid #e7e2d8; padding: 1.2mm 1.5mm; vertical-align: top; }
.hl { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
.hl ul { margin: 0; padding-left: 4mm; } .hl li { margin-bottom: 1.5mm; }
.hl .pos h3 { color: #2f8f5b; } .hl .neg h3 { color: #b3361f; }
.muted, .notes { color: #6b6459; } .notes { font-size: 8pt; margin-top: 8mm; border-top: 1px solid #e7e2d8; padding-top: 2mm; }
.empty { padding: 6mm; background: #f6f3ee; }
/* Monatsbericht: Titelseite, Serifenüberschriften */
.style-bericht h1, .style-bericht h2 { font-family: Newsreader, Georgia, "Times New Roman", serif; font-weight: 500; }
.style-bericht .cover { min-height: 230mm; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 20mm; border-left: 4mm solid ${accent}; padding-left: 10mm; break-after: page; }
.style-bericht .cover h1 { font-size: 34pt; }
.style-bericht .cover .logo, .style-bericht .cover .wordmark { position: absolute; top: 24mm; }
.style-bericht .block-medienliste { break-before: page; }
/* Kompakt: eng gesetzt */
.style-kompakt { font-size: 9.8pt; } .style-kompakt .block { margin-bottom: 5mm; } .style-kompakt h1 { font-size: 18pt; }
/* Management: große Zahlen, Akzentband */
.style-management .sheet { border-top: 6mm solid ${accent}; padding-top: 6mm; }
.style-management .stat b { font-size: 30pt; color: ${accent}; }
.style-management .block-einordnung p { font-size: 12pt; line-height: 1.5; }
</style></head><body class="style-${tpl.style}"><div class="sheet">${titleBlock}${body}<div class="notes">${notes.map(esc).join(" ")}</div></div></body></html>`;
}
