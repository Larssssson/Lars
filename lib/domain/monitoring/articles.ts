import { z } from "zod";
import { t } from "@/i18n";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { assert, canWorkOnMonitoring, type Actor } from "@/lib/domain/permissions";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { addDays, atTime, dateKey, startOfDay } from "@/lib/time";

type Db = PrismaClient | Prisma.TransactionClient;
const uuid = z.uuid();
const DAY = 86_400_000;

/** Volltexte werden nach 30 Tagen gelöscht (BRIEFING 7.6, Urheberrecht). */
export const FULL_TEXT_DAYS = 30;

export const MONITORING_FIELDS = ["publishedAt", "headline", "url", "teaser", "media", "author", "language", "reach"] as const;
export type MonitoringField = (typeof MONITORING_FIELDS)[number];
export type MonitoringMapping = Record<string, MonitoringField | "">;

const GUESSES: [RegExp, MonitoringField][] = [
  [/^(date|datum|published|veröffentlicht)/i, "publishedAt"],
  [/^(headline|titel|title|überschrift)/i, "headline"],
  [/^(url|link)/i, "url"],
  [/^(opening text|hit sentence|teaser|snippet|summary|lead)/i, "teaser"],
  [/^(source|medium|quelle|outlet|publication)/i, "media"],
  [/^(influencer|author|autor|journalist)/i, "author"],
  [/^(language|sprache)/i, "language"],
  [/^(reach|reichweite|audience)/i, "reach"],
];

/** Vorschlag aus den Spaltennamen; Opening Text und Hit Sentence ergeben zusammen den Teaser (DECISIONS D-102). */
export function guessMonitoringMapping(columns: string[]): MonitoringMapping {
  const mapping: MonitoringMapping = {};
  const used = new Set<MonitoringField>();
  for (const column of columns) {
    const field = GUESSES.find(([re, f]) => re.test(column.trim()) && (f === "teaser" || !used.has(f)))?.[1];
    mapping[column] = field ?? "";
    if (field) used.add(field);
  }
  return mapping;
}

/** Die gespeicherte Zuordnung gilt, wenn alle ihre Spalten in der Datei vorkommen. */
export async function savedMonitoringMapping(db: PrismaClient, columns: string[]): Promise<{ id: string; mapping: MonitoringMapping } | null> {
  const saved = await db.importMapping.findFirst({ where: { kind: "MONITORING" }, orderBy: { updatedAt: "desc" } });
  if (!saved) return null;
  const mapping = saved.mapping as MonitoringMapping;
  const used = Object.entries(mapping).filter(([, f]) => f).map(([c]) => c);
  return used.every((c) => columns.includes(c)) ? { id: saved.id, mapping: Object.fromEntries(columns.map((c) => [c, mapping[c] ?? ""])) } : null;
}

/** Datum aus dem Export: 2026-10-19, 19.10.2026 oder ISO mit Uhrzeit; reine Tage als 12 Uhr Berliner Zeit. */
export function parseArticleDate(raw: string): Date | null {
  const v = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return atTime(`${m[1]}-${m[2]}-${m[3]}`, "12:00");
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
  if (m) return atTime(`${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`, "12:00");
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type ArticleRow = {
  publishedAt: Date;
  headline: string;
  url: string | null;
  teaser: string | null;
  media: string;
  author: string | null;
  language: string | null;
  reach: number | null;
};

export function mapArticleRows(rows: Record<string, string>[], mapping: MonitoringMapping, now: Date): ArticleRow[] {
  const get = (record: Record<string, string>, field: MonitoringField) =>
    Object.entries(mapping)
      .filter(([, f]) => f === field)
      .map(([column]) => (record[column] ?? "").trim())
      .filter(Boolean)
      .join(" ");
  return rows
    .map((r) => {
      const reach = Number.parseInt(get(r, "reach").replace(/\D/g, ""), 10);
      return {
        publishedAt: parseArticleDate(get(r, "publishedAt")) ?? now,
        headline: get(r, "headline"),
        url: get(r, "url") || null,
        teaser: get(r, "teaser") || null,
        media: get(r, "media"),
        author: get(r, "author") || null,
        language: get(r, "language") || null,
        reach: Number.isFinite(reach) ? reach : null,
      };
    })
    .filter((r) => r.headline && r.media);
}

/** Gleiche Artikel: gleiche URL oder gleiche Headline plus Medium am selben Tag (BRIEFING 7.6). */
export function articleKeys(a: { url: string | null; headline: string; media?: string; mediaName?: string; publishedAt: Date }): string[] {
  const media = (a.media ?? a.mediaName ?? "").toLowerCase().trim();
  const keys = [`H:${a.headline.toLowerCase().replace(/\s+/g, " ").trim()}|${media}|${dateKey(a.publishedAt)}`];
  if (a.url) keys.push(`U:${a.url.trim()}`);
  return keys;
}

/** Bekannter Autor: gleicher Name und gleiches Medium im Hub (BRIEFING 7.6); es entsteht kein neuer Kontakt. */
async function knownAuthor(db: Db, author: string | null, mediaId: string | null): Promise<string | null> {
  if (!author || !mediaId) return null;
  const parts = author.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const lastName = parts.pop()!;
  const match = await db.journalist.findFirst({
    where: { mediaId, lastName: { equals: lastName, mode: "insensitive" }, firstName: { equals: parts.join(" "), mode: "insensitive" } },
    select: { id: true },
  });
  return match?.id ?? null;
}

async function mediaIdByName(db: Db, name: string): Promise<string | null> {
  return (await db.media.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" } }, select: { id: true } }))?.id ?? null;
}

/**
 * Artikel übernehmen: gleiche Artikel werden zusammengefasst (auch mit früheren Importen),
 * bekannte Autoren ihrer Artikel-Historie zugeordnet. Gespeichert werden nur Headline, Teaser
 * wie geliefert, Link und Metadaten.
 */
export async function storeArticles(deps: Deps, actor: Actor, rows: ArticleRow[], importId: string | null) {
  const since = new Date(Math.min(...rows.map((r) => r.publishedAt.getTime()), deps.now().getTime()) - 2 * DAY);
  const existing = await deps.db.article.findMany({ where: { publishedAt: { gte: since } }, select: { url: true, headline: true, mediaName: true, publishedAt: true } });
  const seen = new Set(existing.flatMap((a) => articleKeys(a)));
  const created: string[] = [];
  let merged = 0;
  let assigned = 0;
  for (const row of rows) {
    const keys = articleKeys(row);
    if (keys.some((k) => seen.has(k))) {
      merged += 1;
      continue;
    }
    keys.forEach((k) => seen.add(k));
    const mediaId = await mediaIdByName(deps.db, row.media);
    const journalistId = await knownAuthor(deps.db, row.author, mediaId);
    const article = await deps.db.article.create({
      data: {
        importId,
        publishedAt: row.publishedAt,
        headline: row.headline.slice(0, 500),
        teaser: row.teaser?.slice(0, 2000) ?? null,
        url: row.url?.slice(0, 1000) ?? null,
        mediaName: row.media.slice(0, 200),
        mediaId,
        authorName: row.author?.slice(0, 200) ?? null,
        journalistId,
        language: row.language,
        reach: row.reach,
        createdAt: deps.now(),
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });
    if (journalistId) {
      assigned += 1;
      await deps.db.journalist.update({ where: { id: journalistId }, data: { lastActivityAt: deps.now() } });
    }
    created.push(article.id);
  }
  return { created, merged, assigned };
}

function checkFileName(name: string) {
  const lower = name.toLowerCase();
  if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx")) throw new DomainError(t.monitoring.errors.fileType);
  return lower.endsWith(".xlsx") ? ("MELTWATER_XLSX" as const) : ("MELTWATER_CSV" as const);
}

/**
 * Schritt 1 (BRIEFING 7.6): Export hochladen. Die Datei bleibt abgelegt; vorgeschlagen wird die
 * gespeicherte Zuordnung, sonst eine aus den Spaltennamen.
 */
export async function uploadMonitoringFile(deps: Deps, actor: Actor, file: { name: string; mimeType: string; data: Uint8Array }) {
  assert(canWorkOnMonitoring(actor));
  checkFileName(file.name);
  const table = await deps.monitoring.readRows({ fileName: file.name, data: file.data }).catch(() => {
    throw new DomainError(t.monitoring.errors.fileType);
  });
  if (!table.rows.length) throw new DomainError(t.monitoring.import.noRows);
  const storageKey = `monitoring/${crypto.randomUUID()}`;
  await deps.files.put(storageKey, file.data, file.mimeType || "application/octet-stream");
  const stored = await deps.db.file.create({
    data: { storageKey, name: file.name, mimeType: file.mimeType || "application/octet-stream", size: file.data.byteLength, uploadedBy: actor.id, createdBy: actor.id },
  });
  const saved = await savedMonitoringMapping(deps.db, table.columns);
  return { fileId: stored.id, fileName: stored.name, columns: table.columns, sample: table.rows.slice(0, 3), mapping: saved?.mapping ?? guessMonitoringMapping(table.columns), savedApplied: Boolean(saved) };
}

/** Schritt 2: mit der Zuordnung importieren; die Zuordnung wird gespeichert. */
export async function importMonitoringFile(deps: Deps, actor: Actor, input: { fileId: string; mapping: MonitoringMapping }) {
  assert(canWorkOnMonitoring(actor));
  const fields = new Set(Object.values(input.mapping));
  if (!fields.has("headline") || !fields.has("media") || !fields.has("publishedAt")) throw new DomainError(t.monitoring.import.mappingRequired);
  const file = uuid.safeParse(input.fileId).success ? await deps.db.file.findUnique({ where: { id: input.fileId } }) : null;
  if (!file || file.uploadedBy !== actor.id || !file.storageKey.startsWith("monitoring/")) throw new NotFoundError(t.monitoring.errors.fileMissing);
  if (await deps.db.monitoringImport.findFirst({ where: { fileId: file.id } })) throw new DomainError(t.monitoring.errors.fileMissing);
  const sourceType = checkFileName(file.name);
  const data = await deps.files.get(file.storageKey).catch(() => null);
  if (!data) throw new NotFoundError(t.monitoring.errors.fileMissing);
  const table = await deps.monitoring.readRows({ fileName: file.name, data });
  const rows = mapArticleRows(table.rows, input.mapping, deps.now());
  if (!rows.length) throw new DomainError(t.monitoring.import.noRows);

  const saved = await savedMonitoringMapping(deps.db, table.columns);
  const mapping = saved
    ? await deps.db.importMapping.update({ where: { id: saved.id }, data: { mapping: input.mapping, updatedBy: actor.id } })
    : await deps.db.importMapping.create({ data: { name: "Meltwater", kind: "MONITORING", mapping: input.mapping, createdBy: actor.id, updatedBy: actor.id } });
  const monitoringImport = await deps.db.monitoringImport.create({
    data: { uploadedBy: actor.id, fileId: file.id, sourceType, mappingId: mapping.id, createdAt: deps.now(), createdBy: actor.id, updatedBy: actor.id },
  });
  const result = await storeArticles(deps, actor, rows, monitoringImport.id);
  await deps.db.monitoringImport.update({ where: { id: monitoringImport.id }, data: { articleCount: result.created.length } });
  return { importId: monitoringImport.id, ...result };
}

export const manualArticleSchema = z.object({
  headline: z.string().trim().min(1, t.monitoring.errors.headlineRequired).max(500),
  media: z.string().trim().min(1, t.monitoring.errors.mediaRequired).max(200),
  url: z.string().trim().max(1000).nullish().transform((v) => v || null),
  author: z.string().trim().max(200).nullish().transform((v) => v || null),
  teaser: z.string().trim().max(2000).nullish().transform((v) => v || null),
  publishedAt: z.date().nullish(),
});

/** Einzelner Artikel von Hand (URL, Headline, Medium, Autor). */
export async function createManualArticle(deps: Deps, actor: Actor, raw: z.input<typeof manualArticleSchema>) {
  assert(canWorkOnMonitoring(actor));
  const input = manualArticleSchema.parse(raw);
  const monitoringImport = await deps.db.monitoringImport.create({ data: { uploadedBy: actor.id, sourceType: "MANUELL", articleCount: 0, createdAt: deps.now(), createdBy: actor.id, updatedBy: actor.id } });
  const result = await storeArticles(deps, actor, [{ ...input, publishedAt: input.publishedAt ?? deps.now(), language: null, reach: null }], monitoringImport.id);
  await deps.db.monitoringImport.update({ where: { id: monitoringImport.id }, data: { articleCount: result.created.length } });
  return result;
}

export async function requireArticle(db: Db, articleId: string) {
  if (!uuid.safeParse(articleId).success) throw new NotFoundError(t.errors.notFound);
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) throw new NotFoundError(t.errors.notFound);
  return article;
}

/** Volltext einfügen: nur für die Zusammenfassung, Löschung nach 30 Tagen (BRIEFING 7.6 Schritt 5). */
export async function setFullText(deps: Deps, actor: Actor, articleId: string, text: string) {
  assert(canWorkOnMonitoring(actor));
  await requireArticle(deps.db, articleId);
  const clean = text.trim().slice(0, 60_000);
  const expires = clean ? startOfDay(addDays(dateKey(deps.now()), FULL_TEXT_DAYS + 1)) : null;
  return deps.db.article.update({
    where: { id: articleId },
    data: { fullTextPasted: clean || null, fullTextExpiresAt: expires, updatedBy: actor.id },
  });
}

/** Job täglich: abgelaufene Volltexte löschen. */
export async function purgeExpiredFullTexts(deps: Pick<Deps, "db" | "now">): Promise<number> {
  const result = await deps.db.article.updateMany({
    where: { fullTextExpiresAt: { lte: deps.now() }, fullTextPasted: { not: null } },
    data: { fullTextPasted: null, fullTextExpiresAt: null },
  });
  return result.count;
}
