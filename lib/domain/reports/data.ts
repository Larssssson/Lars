import { parseCsvText, parseXlsxData, type Table } from "@/lib/files/tabular";
import { parseArticleDate } from "@/lib/domain/monitoring/articles";

/**
 * Auswertung eines Meltwater-Exports für das Reporting (DECISIONS D-133). Ohne Datenbank und ohne DOM,
 * damit sie für Vorschau, Word, PDF und PowerPoint gleich rechnet und einzeln testbar ist.
 */

export type Sentiment = "positiv" | "neutral" | "negativ";
export type Tier = 1 | 2 | 3;

export type ReportRow = {
  date: Date;
  headline: string;
  url: string | null;
  outlet: string;
  author: string | null;
  reach: number;
  sentiment: Sentiment | null;
  /** Suchname (Meltwater „Input Name“) oder Schlagwörter, für die Zuordnung zu Kunde und Wettbewerbern */
  entityText: string;
  /** Überschrift und Anrisstexte */
  text: string;
  /** Tags, Kategorien, Quellentyp: für „Paid ausschließen“ */
  tags: string;
};

type Field = "date" | "headline" | "url" | "outlet" | "author" | "reach" | "sentiment" | "text" | "entity" | "tags";
const COLUMN_GUESSES: [RegExp, Field][] = [
  [/^(date|datum|published( date)?|veröffentlicht( am)?)$/i, "date"],
  [/^(headline|titel|title|überschrift)$/i, "headline"],
  [/^(url|link)$/i, "url"],
  [/^(source|source name|medium|quelle|outlet|publication|medientitel)$/i, "outlet"],
  [/^(influencer|author|autor|journalist)$/i, "author"],
  [/^(reach|reichweite|audience|potential reach)$/i, "reach"],
  [/^(sentiment|tonalität|tonalitaet|stimmung)$/i, "sentiment"],
  [/^(opening text|hit sentence|teaser|snippet|summary|lead|anriss)$/i, "text"],
  [/^(input name|search name|suchname|suche|keywords|key phrases|schlagwörter|schlagworte)$/i, "entity"],
  [/^(document tags|tags|custom categories|kategorien?|source type|medientyp|media type)$/i, "tags"],
];

export function detectColumns(columns: string[]): Record<Field, string[]> {
  const found = Object.fromEntries(COLUMN_GUESSES.map(([, f]) => [f, [] as string[]])) as Record<Field, string[]>;
  for (const column of columns) {
    const field = COLUMN_GUESSES.find(([re]) => re.test(column.trim()))?.[1];
    if (field) found[field].push(column);
  }
  return found;
}

export const REQUIRED_FIELDS: Field[] = ["date", "headline", "outlet"];

/** CSV (auch UTF-16 mit Tabulatoren, wie Meltwater exportiert) oder XLSX lesen. */
export async function readTable(fileName: string, data: Uint8Array): Promise<Table> {
  if (fileName.toLowerCase().endsWith(".xlsx")) return parseXlsxData(data);
  const utf16 = data[0] === 0xff && data[1] === 0xfe;
  return parseCsvText(new TextDecoder(utf16 ? "utf-16le" : "utf-8").decode(data));
}

function parseSentiment(raw: string): Sentiment | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (/^(pos|positiv|positive)/.test(v)) return "positiv";
  if (/^(neg|negativ|negative)/.test(v)) return "negativ";
  if (/^(neu|neutral)/.test(v)) return "neutral";
  const n = Number(v.replace(",", "."));
  if (Number.isFinite(n)) return n > 0.1 ? "positiv" : n < -0.1 ? "negativ" : "neutral";
  return null;
}

function parseReach(raw: string): number {
  const n = Number(raw.replace(/[.\s']/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function toRows(table: Table): { rows: ReportRow[]; missing: Field[]; skipped: number } {
  const cols = detectColumns(table.columns);
  const missing = REQUIRED_FIELDS.filter((f) => cols[f].length === 0);
  if (missing.length) return { rows: [], missing, skipped: table.rows.length };
  const pick = (row: Record<string, string>, f: Field) => cols[f].map((c) => row[c] ?? "").filter(Boolean).join(" · ");
  const rows: ReportRow[] = [];
  let skipped = 0;
  for (const raw of table.rows) {
    const date = parseArticleDate(raw[cols.date[0]!] ?? "");
    const headline = (raw[cols.headline[0]!] ?? "").trim();
    const outlet = (raw[cols.outlet[0]!] ?? "").trim();
    if (!date || !headline || !outlet) {
      skipped++;
      continue;
    }
    rows.push({
      date,
      headline,
      url: cols.url[0] ? raw[cols.url[0]]?.trim() || null : null,
      outlet,
      author: cols.author[0] ? raw[cols.author[0]]?.trim() || null : null,
      reach: cols.reach[0] ? parseReach(raw[cols.reach[0]] ?? "") : 0,
      sentiment: cols.sentiment[0] ? parseSentiment(raw[cols.sentiment[0]] ?? "") : null,
      entityText: pick(raw, "entity"),
      text: [headline, pick(raw, "text")].join(" "),
      tags: pick(raw, "tags"),
    });
  }
  return { rows, missing, skipped };
}

// ------------------------------------------------------------- Auswertung

export type ReportSettings = {
  clientName: string;
  clientAliases: string[];
  competitors: string[];
  tier1: string[];
  tier2: string[];
  periodStart: Date;
  periodEnd: Date;
  excludePaid: boolean;
  topicFilter: string[];
};

const PAID = /\b(paid|sponsored|gesponsert|anzeige|advertorial|promotion|bezahlt)\b/i;

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

function mentions(row: ReportRow, name: string): boolean {
  const n = norm(name.trim());
  if (!n) return false;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u");
  return re.test(norm(row.entityText)) || re.test(norm(row.text));
}

export function tierOf(outlet: string, reach: number, s: Pick<ReportSettings, "tier1" | "tier2">): Tier {
  const o = norm(outlet);
  if (s.tier1.some((m) => norm(m) === o)) return 1;
  if (s.tier2.some((m) => norm(m) === o)) return 2;
  if (s.tier1.length || s.tier2.length) return 3;
  // ohne eigene Listen nach Reichweite (DECISIONS D-133)
  return reach >= 1_000_000 ? 1 : reach >= 100_000 ? 2 : 3;
}

const monthKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).format(d);

export type ReportData = ReturnType<typeof analyze>;

/** Kennzahlen für den Zeitraum; Verlauf über bis zu sechs Monate bis zum Ende des Zeitraums, soweit der Export sie enthält. */
export function analyze(all: ReportRow[], s: ReportSettings) {
  const topics = s.topicFilter.map((t) => t.trim()).filter(Boolean);
  const usable = all.filter((r) => (!s.excludePaid || !PAID.test(`${r.tags} ${r.outlet}`)) && (!topics.length || topics.some((t) => mentions(r, t))));
  const excludedPaid = s.excludePaid ? all.filter((r) => PAID.test(`${r.tags} ${r.outlet}`)).length : 0;
  const clientNames = [s.clientName, ...s.clientAliases].filter(Boolean);
  const isClient = (r: ReportRow) => clientNames.some((n) => mentions(r, n));
  // Hat der Export keine Zuordnung zu Wettbewerbern, gelten alle Treffer als Kunde (reiner Kunden-Export)
  const anyCompetitor = s.competitors.some((c) => usable.some((r) => mentions(r, c)));
  const anyClient = usable.some(isClient);
  const forClient = (r: ReportRow) => isClient(r) || (!anyClient && !s.competitors.some((c) => mentions(r, c)));

  const inPeriod = usable.filter((r) => r.date >= s.periodStart && r.date <= s.periodEnd);
  const placements = inPeriod.filter(forClient).sort((a, b) => b.reach - a.reach || b.date.getTime() - a.date.getTime());

  const sentiment = { positiv: 0, neutral: 0, negativ: 0, ohne: 0 };
  for (const r of placements) sentiment[r.sentiment ?? "ohne"]++;

  const tiers = { 1: 0, 2: 0, 3: 0 } as Record<Tier, number>;
  const tierReach = { 1: 0, 2: 0, 3: 0 } as Record<Tier, number>;
  for (const r of placements) {
    const tier = tierOf(r.outlet, r.reach, s);
    tiers[tier]++;
    tierReach[tier] += r.reach;
  }

  const sov = [
    { name: s.clientName, count: placements.length, isClient: true },
    ...s.competitors.filter(Boolean).map((c) => ({ name: c, count: inPeriod.filter((r) => mentions(r, c)).length, isClient: false })),
  ];
  const sovTotal = sov.reduce((sum, e) => sum + e.count, 0);

  // Verlauf: Monate bis zum Ende des Zeitraums (höchstens sechs), Kunde und Wettbewerb gesamt
  const months: string[] = [];
  const end = new Date(s.periodEnd);
  for (let i = 5; i >= 0; i--) months.push(monthKey(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 15))));
  const firstData = usable.length ? monthKey(new Date(Math.min(...usable.map((r) => r.date.getTime())))) : months[months.length - 1]!;
  const trendMonths = months.filter((m) => m >= firstData);
  const trend = trendMonths.map((m) => ({
    month: m,
    client: usable.filter((r) => monthKey(r.date) === m && forClient(r)).length,
    competitors: usable.filter((r) => monthKey(r.date) === m && s.competitors.some((c) => mentions(r, c))).length,
  }));

  const byOutlet = new Map<string, number>();
  for (const r of placements) byOutlet.set(r.outlet, (byOutlet.get(r.outlet) ?? 0) + 1);

  return {
    total: placements.length,
    reach: placements.reduce((sum, r) => sum + r.reach, 0),
    outlets: byOutlet.size,
    topOutlets: [...byOutlet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
    sentiment,
    tiers,
    tierReach,
    sov: sov.map((e) => ({ ...e, share: sovTotal ? e.count / sovTotal : 0 })),
    hasCompetitorData: anyCompetitor,
    trend,
    top: placements.slice(0, 10),
    positives: placements.filter((r) => r.sentiment === "positiv").slice(0, 3),
    negatives: placements.filter((r) => r.sentiment === "negativ").slice(0, 3),
    list: [...placements].sort((a, b) => a.date.getTime() - b.date.getTime()),
    excludedPaid,
    tierOf: (r: ReportRow) => tierOf(r.outlet, r.reach, s),
  };
}
