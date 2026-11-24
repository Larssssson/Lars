import { t } from "@/i18n";
import { formatDate } from "@/lib/time";
import type { ReportTemplate } from "@/lib/generated/prisma/enums";
import { barChart, SENTIMENT_COLORS, stackBar, trendChart } from "./charts";
import type { ReportData, ReportRow } from "./data";
import { orderedBlocks, type ReportBlock } from "./templates";

/**
 * Gemeinsames Modell für Vorschau, PDF und Word: Abschnitte mit Kennzahlen, Text, Diagramm (SVG) und Tabellen.
 * Jede Ausgabe stellt dieselben Abschnitte in ihrer Form dar.
 */
export type Stat = { label: string; value: string };
export type ReportSection = {
  block: ReportBlock;
  title: string;
  stats?: Stat[];
  paragraphs?: string[];
  chart?: { svg: string; alt: string };
  table?: { head: string[]; rows: string[][]; widths?: number[] };
  highlights?: { positives: string[]; negatives: string[] };
  note?: string;
};

export type ReportMeta = {
  title: string;
  clientName: string;
  template: ReportTemplate;
  periodStart: Date;
  periodEnd: Date;
  commentary: string | null;
  blocks: string[];
  status: "ENTWURF" | "FREIGEGEBEN";
  approvedByName: string | null;
  approvedAt: Date | null;
  topicFilter: string[];
};

const num = (n: number) => new Intl.NumberFormat("de-DE").format(n);
const compact = (n: number) => new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const pct = (x: number) => `${Math.round(x * 100)} %`;
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(y!, m! - 1, 15)));
};
export const articleLine = (r: ReportRow) => `${r.headline} (${r.outlet}, ${formatDate(r.date)}${r.reach ? `, Reichweite ${compact(r.reach)}` : ""})`;

export function buildSections(meta: ReportMeta, data: ReportData, accent: string): ReportSection[] {
  const d = t.reports.doc;
  const sections: ReportSection[] = [];
  for (const block of orderedBlocks(meta.template, meta.blocks)) {
    switch (block) {
      case "kennzahlen":
        sections.push({
          block,
          title: d.kennzahlen,
          stats: [
            { label: d.placements, value: num(data.total) },
            { label: d.reach, value: compact(data.reach) },
            { label: d.outlets, value: num(data.outlets) },
            ...(data.sov.length > 1 ? [{ label: d.shareOfVoice, value: pct(data.sov[0]!.share) }] : []),
          ],
          paragraphs: data.topOutlets.length ? [`${d.topOutlets}: ${data.topOutlets.map((o) => `${o.name} (${o.count})`).join(", ")}`] : undefined,
        });
        break;
      case "einordnung":
        sections.push({ block, title: d.einordnung, paragraphs: meta.commentary?.trim() ? meta.commentary.trim().split(/\n{2,}/) : [d.noCommentary] });
        break;
      case "verlauf":
        sections.push({
          block,
          title: d.verlauf,
          chart: {
            svg: trendChart(data.trend.map((p) => ({ label: monthLabel(p.month), client: p.client, competitors: p.competitors })), accent, { client: meta.clientName, competitors: d.competitorSeries }, data.hasCompetitorData),
            alt: data.trend.map((p) => `${monthLabel(p.month)}: ${p.client}`).join(", "),
          },
        });
        break;
      case "shareOfVoice":
        sections.push(
          data.sov.length > 1
            ? {
                block,
                title: d.shareOfVoice,
                chart: {
                  svg: barChart(data.sov.map((e) => ({ label: e.name, value: e.count, note: `${num(e.count)} · ${pct(e.share)}`, highlight: e.isClient })), accent),
                  alt: data.sov.map((e) => `${e.name} ${pct(e.share)}`).join(", "),
                },
                table: { head: ["", d.articles, d.share], rows: data.sov.map((e) => [e.name, num(e.count), pct(e.share)]) },
              }
            : { block, title: d.shareOfVoice, paragraphs: [d.sovNoCompetitors] },
        );
        break;
      case "tiers":
        sections.push({
          block,
          title: d.tiers,
          chart: {
            svg: barChart(([1, 2, 3] as const).map((n) => ({ label: d.tier(n), value: data.tiers[n], note: `${num(data.tiers[n])} · ${compact(data.tierReach[n])}`, highlight: n === 1 })), accent),
            alt: ([1, 2, 3] as const).map((n) => `${d.tier(n)}: ${data.tiers[n]}`).join(", "),
          },
        });
        break;
      case "tonalitaet":
        sections.push({
          block,
          title: d.tonalitaet,
          chart: {
            svg: stackBar((["positiv", "neutral", "negativ", "ohne"] as const).filter((k) => k !== "ohne" || data.sentiment.ohne > 0).map((k) => ({ label: d.sentiments[k], value: data.sentiment[k], color: SENTIMENT_COLORS[k] }))),
            alt: (["positiv", "neutral", "negativ"] as const).map((k) => `${d.sentiments[k]} ${data.sentiment[k]}`).join(", "),
          },
        });
        break;
      case "highlights":
        sections.push({ block, title: d.highlights, highlights: { positives: data.positives.map(articleLine), negatives: data.negatives.map(articleLine) } });
        break;
      case "topArtikel":
        sections.push({
          block,
          title: d.topArtikel,
          table: { head: [d.date, d.outlet, d.headline, d.reach], rows: data.top.map((r) => [formatDate(r.date), r.outlet, r.headline, r.reach ? compact(r.reach) : "–"]), widths: [14, 20, 52, 14] },
        });
        break;
      case "medienliste":
        sections.push({
          block,
          title: d.medienliste,
          table: { head: [d.date, d.outlet, d.headline, "Tier"], rows: data.list.map((r) => [formatDate(r.date), r.outlet, r.headline, String(data.tierOf(r))]), widths: [14, 22, 56, 8] },
        });
        break;
    }
  }
  return sections;
}

export function footnotes(meta: ReportMeta, data: ReportData): string[] {
  const d = t.reports.doc;
  return [
    ...(data.excludedPaid ? [d.excludedPaid(data.excludedPaid)] : []),
    ...(meta.topicFilter.length ? [d.filtered(meta.topicFilter.join(", "))] : []),
    d.source,
  ];
}

export function statusLine(meta: ReportMeta): string {
  return meta.status === "FREIGEGEBEN" && meta.approvedByName && meta.approvedAt ? t.reports.doc.approved(meta.approvedByName, formatDate(meta.approvedAt)) : t.reports.doc.draft;
}

export function periodLine(meta: ReportMeta): string {
  return t.reports.doc.period(formatDate(meta.periodStart), formatDate(meta.periodEnd));
}
