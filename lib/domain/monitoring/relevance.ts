import { t } from "@/i18n";
import { AiNotAllowedError, AiOutputError, AiUnavailableError } from "@/lib/ai/errors";
import { callAi } from "@/lib/ai/service";
import type { SectionContent } from "@/lib/domain/clients/profile-sections";
import type { Deps } from "@/lib/domain/deps";
import { NotFoundError } from "@/lib/domain/errors";
import { assert, canWorkOnMonitoring, type Actor } from "@/lib/domain/permissions";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { dateKey, startOfDay, addDays } from "@/lib/time";
import { generalSettings } from "@/lib/domain/settings";
import { requireArticle } from "./articles";

/** "Heute relevant": die höchsten Werte ab der Schwelle; Schwelle und Anzahl in den Einstellungen (Standard 50 und 10). */
const BATCH = 15;
const FULL_TEXT_FOR_AI = 4000;

/** Aktive Kunden für den Pressespiegel (ohne "RP intern"). */
export function activeClients(db: PrismaClient) {
  return db.client.findMany({ where: { status: "AKTIV", isInternal: false }, orderBy: { name: "asc" } });
}

const clean = (v: unknown) =>
  (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []).map((x) => (typeof x === "string" ? x : String((x as { text?: string }).text ?? ""))).filter(Boolean);

/** Kompaktes Profil je Kunde: Themen und Suchbegriffe, Wettbewerber, Regulierung, Sprecher, Kernbotschaften. */
async function compactProfiles(db: PrismaClient, clients: { id: string; shortName: string; name: string }[]) {
  const [sections, speakers] = await Promise.all([
    db.clientProfileSection.findMany({ where: { clientId: { in: clients.map((c) => c.id) }, key: { in: ["themen_suchbegriffe", "wettbewerber", "ziele_kernbotschaften"] } } }),
    db.speaker.findMany({ where: { clientId: { in: clients.map((c) => c.id) } }, select: { clientId: true, name: true } }),
  ]);
  return clients
    .map((c) => {
      const get = (key: string) => (sections.find((s) => s.clientId === c.id && s.key === key)?.content ?? {}) as SectionContent;
      const themen = get("themen_suchbegriffe");
      return [
        `${c.shortName}: ${c.name}`,
        `  Themen: ${[...clean(themen.themen), ...clean(themen.technologien)].join("; ") || "-"}`,
        `  Suchbegriffe: ${clean(themen.suchbegriffe).join("; ") || "-"}`,
        `  Regulierung: ${clean(themen.regulierung).join("; ") || "-"}`,
        `  Wettbewerber: ${clean(get("wettbewerber").wettbewerber).join("; ") || "-"}`,
        `  Sprecher: ${speakers.filter((s) => s.clientId === c.id).map((s) => s.name).join("; ") || "-"}`,
        `  Kernbotschaften: ${clean(get("ziele_kernbotschaften").kernbotschaften).join("; ") || "-"}`,
      ].join("\n");
    })
    .join("\n");
}

/**
 * Relevanz bewerten (BRIEFING 7.6 Schritt 3): jeder Artikel für jeden aktiven Kunden mit "KI erlaubt",
 * Wert 0 bis 100 und Begründung. Artikel heißen für die KI nach ihrer URL, Kunden nach dem
 * Kurznamen (DECISIONS D-103). Kunden ohne KI bleiben unbewertet; die Auswahl geht trotzdem.
 */
export async function rateArticles(deps: Deps, articleIds: string[]): Promise<{ rated: string[]; skipped: string[]; notice: string | null }> {
  const clients = await activeClients(deps.db);
  const allowed = clients.filter((c) => c.aiAllowed);
  const skipped = clients.filter((c) => !c.aiAllowed).map((c) => c.name);
  if (!articleIds.length || !allowed.length) return { rated: [], skipped, notice: null };
  const articles = await deps.db.article.findMany({ where: { id: { in: articleIds } } });
  const kunden = await compactProfiles(deps.db, allowed);
  let notice: string | null = null;
  for (let i = 0; i < articles.length; i += BATCH) {
    const batch = articles.slice(i, i + BATCH);
    const keyOf = (a: (typeof batch)[number], n: number) => a.url ?? `A${i + n + 1}`;
    const artikel = batch
      .map((a, n) =>
        [`${keyOf(a, n)}: ${a.headline} (${a.mediaName}, ${dateKey(a.publishedAt)})`, a.teaser ? `  Teaser: ${a.teaser}` : null, a.fullTextPasted ? `  Volltext: ${a.fullTextPasted.slice(0, FULL_TEXT_FOR_AI)}` : null]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n");
    try {
      const result = await callAi(deps, "relevance", { clientIds: allowed.map((c) => c.id), vars: { kunden, artikel } });
      for (const r of result.data.results) {
        const n = batch.findIndex((a, k) => keyOf(a, k) === r.articleId);
        const client = allowed.find((c) => c.shortName === r.clientId);
        if (n < 0 || !client) continue;
        const data = { score: r.score, reason: r.reason, model: result.model, promptVersion: result.promptVersion };
        await deps.db.articleRelevance.upsert({
          where: { articleId_clientId: { articleId: batch[n]!.id, clientId: client.id } },
          update: data,
          create: { articleId: batch[n]!.id, clientId: client.id, ...data },
        });
      }
    } catch (error) {
      if (!(error instanceof AiUnavailableError || error instanceof AiOutputError || error instanceof AiNotAllowedError)) throw error;
      notice = error.message;
      break;
    }
  }
  return { rated: notice ? [] : allowed.map((c) => c.name), skipped, notice };
}

/** Nach eingefügtem Volltext neu bewerten. */
export async function rerateArticle(deps: Deps, actor: Actor, articleId: string) {
  assert(canWorkOnMonitoring(actor));
  await requireArticle(deps.db, articleId);
  return rateArticles(deps, [articleId]);
}

const articleInclude = {
  relevances: { include: { client: { select: { id: true, name: true, shortName: true } } } },
  actions: { select: { clientId: true, kind: true, resultTaskId: true, resultJournalistId: true } },
} satisfies Prisma.ArticleInclude;
export type ArticleView = Prisma.ArticleGetPayload<{ include: typeof articleInclude }>;

/** Heute importierte Artikel (Berliner Tag). */
function todayRange(now: Date) {
  const key = dateKey(now);
  return { gte: startOfDay(key), lt: startOfDay(addDays(key, 1)) };
}

/** "Heute relevant" pro Kunde: die Top-Artikel ab der Schwelle aus den heutigen Importen. */
export async function todayRelevant(db: PrismaClient, clientId: string, now: Date) {
  const { relevanceThreshold, topArticles } = await generalSettings(db);
  const relevances = await db.articleRelevance.findMany({
    where: { clientId, score: { gte: relevanceThreshold }, article: { createdAt: todayRange(now) } },
    include: { article: { include: articleInclude } },
    orderBy: [{ score: "desc" }],
    take: topArticles,
  });
  return relevances.map((r) => r.article);
}

/** "Alle Artikel" mit Suche in Headline, Teaser, Medium und Autor. */
export async function allArticles(db: PrismaClient, filter: { q?: string | null; from?: Date | null; to?: Date | null }) {
  const q = filter.q?.trim();
  return db.article.findMany({
    where: {
      publishedAt: filter.from || filter.to ? { gte: filter.from ?? undefined, lte: filter.to ?? undefined } : undefined,
      ...(q
        ? {
            OR: [
              { headline: { contains: q, mode: "insensitive" } },
              { teaser: { contains: q, mode: "insensitive" } },
              { mediaName: { contains: q, mode: "insensitive" } },
              { authorName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: articleInclude,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
}

/** Häkchen "Aufnehmen" pro Kunde (BRIEFING 7.6 Schritt 5); ohne Bewertung entsteht ein leerer Eintrag. */
export async function setSelected(deps: Deps, actor: Actor, articleId: string, clientId: string, selected: boolean) {
  assert(canWorkOnMonitoring(actor));
  await requireArticle(deps.db, articleId);
  const client = await deps.db.client.findFirst({ where: { id: clientId, status: "AKTIV", isInternal: false } });
  if (!client) throw new NotFoundError(t.errors.notFound);
  await deps.db.articleRelevance.upsert({
    where: { articleId_clientId: { articleId, clientId } },
    update: { selected, selectedBy: selected ? actor.id : null, updatedBy: actor.id },
    create: { articleId, clientId, selected, selectedBy: selected ? actor.id : null, createdBy: actor.id, updatedBy: actor.id },
  });
}

/** Kennzahlen für die Kachel auf dem Dashboard (BRIEFING 7.1). */
export async function monitoringTile(db: PrismaClient, clientId: string | null, now: Date) {
  const range = todayRange(now);
  const key = dateKey(now);
  const { relevanceThreshold } = await generalSettings(db);
  const [imported, relevant, selected, shift] = await Promise.all([
    db.article.count({ where: { createdAt: range } }),
    db.articleRelevance.count({ where: { score: { gte: relevanceThreshold }, article: { createdAt: range }, clientId: clientId ?? undefined, client: { isInternal: false } } }),
    db.articleRelevance.count({ where: { selected: true, article: { createdAt: range }, clientId: clientId ?? undefined } }),
    db.shift.findFirst({ where: { date: new Date(`${key}T00:00:00.000Z`), shiftType: { createsTask: true } }, include: { user: { select: { name: true } } } }),
  ]);
  return { imported, relevant, selected, serviceName: shift?.user.name ?? null };
}
