import { z } from "zod";
import { t } from "@/i18n";
import { AiNotAllowedError, AiOutputError, AiUnavailableError } from "@/lib/ai/errors";
import { callAi } from "@/lib/ai/service";
import type { SectionContent } from "@/lib/domain/clients/profile-sections";
import type { Deps } from "@/lib/domain/deps";
import { NotFoundError } from "@/lib/domain/errors";
import { assert, type Actor } from "@/lib/domain/permissions";
import { blockTexts, type JSONNode } from "@/lib/editor/content";
import { generalSettings } from "@/lib/domain/settings";
import { formatDate } from "@/lib/time";

const uuid = z.uuid();
const DAY = 86_400_000;
const ARTICLE_DAYS = 60;
/** Pressespiegel-Historie für Vorschläge: zwölf Monate */
const PRESS_DAYS = 365;
const MAX_CANDIDATES = 15;
const MAX_SUGGESTIONS = 10;
/** Platzhalter-ID für Aufgaben ohne Dokument: keine Vormerkungen. */
const NO_DOCUMENT = "00000000-0000-4000-8000-000000000000";

const clean = (s: string) => s.replace(/^\[Beispiel\]\s*/i, "").trim().toLowerCase();
/** Wörter ab 4 Buchstaben als Suchbegriffe; Füllwörter fallen weg. */
const STOP = new Set(["eine", "einen", "einer", "eines", "dass", "nicht", "sind", "wird", "werden", "beim", "auch", "oder", "über", "unter", "nach", "mehr", "sein", "seine", "ihre", "diese", "dieser", "dort", "will", "soll", "neue", "neuen", "beispiel"]);
function words(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[\p{L}\d-]{4,}/gu) ?? []).filter((w) => !STOP.has(w)));
}

export type JournalistSuggestion = {
  id: string;
  name: string;
  media: string | null;
  desk: string | null;
  status: string;
  reason: string;
  /** Pressespiegel: Artikel zum Kunden und insgesamt (DECISIONS D-134) */
  pressLine: string | null;
  /** Kontakthistorie: wer hatte wann zuletzt Kontakt */
  contactLine: string | null;
  bookmarked: boolean;
};

/**
 * Reiter Journalisten im Editor (BRIEFING 7.5): passende Kontakte aus dem Hub, verifizierte zuerst,
 * jeder mit Begründung in einer Zeile. Grundlage: Themen und Ressort, Artikel-Historie, Thema des
 * Textes und Zielmedien des Kunden, dazu Pressespiegel (zwölf Monate, Artikel zum Kunden) und Kontakthistorie
 * (DECISIONS D-134). Ohne Treffer bleibt die Liste leer. Die KI ordnet nur die
 * vorausgewählten Kontakte; die Begründung setzt impress aus den Daten zusammen (DECISIONS D-092).
 */
export async function suggestJournalists(deps: Deps, actor: Actor, taskId: string): Promise<{ suggestions: JournalistSuggestion[]; aiOrdered: boolean; embargoAt: Date | null }> {
  assert(actor.active);
  if (!uuid.safeParse(taskId).success) throw new NotFoundError(t.errors.notFound);
  const task = await deps.db.task.findUnique({ where: { id: taskId }, include: { document: true, client: true } });
  if (!task) throw new NotFoundError(t.errors.notFound);
  const now = deps.now();

  const sections = await deps.db.clientProfileSection.findMany({ where: { clientId: task.clientId, key: { in: ["themen_suchbegriffe", "zielmedien"] } } });
  const content = (key: string) => (sections.find((s) => s.key === key)?.content ?? {}) as SectionContent;
  const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : String((x as { text: string }).text))) : []);
  const themes = [...list(content("themen_suchbegriffe").themen), ...list(content("themen_suchbegriffe").suchbegriffe), ...list(content("themen_suchbegriffe").technologien)].map(clean);
  const targetMedia = list(content("zielmedien").medien).map((m) => clean(m.split("(")[0] ?? ""));
  const blocks = task.document ? blockTexts(task.document.content as JSONNode) : [];
  const docText = [task.title, ...blocks.filter((b) => ["headline", "subheadline", "lead", "betreff", "aufhaenger", "anlass", "text"].includes(b.key)).map((b) => b.text)].join(" ");
  const terms = new Set([...words(docText), ...themes.flatMap((th) => [...words(th)])]);

  const yearAgo = new Date(now.getTime() - PRESS_DAYS * DAY);
  const recentFrom = new Date(now.getTime() - ARTICLE_DAYS * DAY);
  const { relevanceThreshold } = await generalSettings(deps.db);
  const relevanceSelect = { where: { clientId: task.clientId }, select: { selected: true, score: true } };
  const articleSelect = { headline: true, teaser: true, publishedAt: true, relevances: relevanceSelect };
  const journalists = await deps.db.journalist.findMany({
    include: {
      media: { select: { name: true } },
      owners: { where: { active: true, pendingApproval: false }, include: { user: { select: { name: true } } } },
      articles: { where: { publishedAt: { gte: yearAgo } }, select: articleSelect, orderBy: { publishedAt: "desc" } },
      bookmarks: { where: { documentId: task.document?.id ?? NO_DOCUMENT }, select: { id: true } },
      contactEvents: { include: { user: { select: { name: true } }, client: { select: { name: true } } }, orderBy: { at: "desc" }, take: 20 },
    },
  });
  // Pressespiegel-Artikel ohne Verknüpfung: Autor mit gleichem Namen (und gleichem Medium, wenn bekannt)
  const unlinked = await deps.db.article.findMany({
    where: { journalistId: null, authorName: { not: null }, publishedAt: { gte: yearAgo } },
    select: { ...articleSelect, authorName: true, mediaName: true },
  });
  const byAuthor = new Map<string, typeof unlinked>();
  for (const a of unlinked) {
    const key = clean(a.authorName ?? "");
    byAuthor.set(key, [...(byAuthor.get(key) ?? []), a]);
  }
  const forClient = (a: { relevances: { selected: boolean; score: number | null }[] }) => a.relevances.some((r) => r.selected || (r.score ?? 0) >= relevanceThreshold);

  const scored = journalists
    .map((j) => {
      const nameMatches = (byAuthor.get(clean(`${j.firstName} ${j.lastName}`)) ?? []).filter((a) => !j.media || clean(a.mediaName) === clean(j.media.name));
      const press = [...j.articles, ...nameMatches].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
      const recent = press.filter((a) => a.publishedAt >= recentFrom);
      const topics = j.topics.filter((topic) => [...words(topic)].some((w) => terms.has(w)) || themes.some((th) => th.includes(clean(topic))));
      const articles = recent.filter((a) => [...words(`${a.headline} ${a.teaser ?? ""}`)].some((w) => terms.has(w)));
      const aboutClient = press.filter(forClient);
      const isTarget = Boolean(j.media && targetMedia.includes(clean(j.media.name)));
      const lastContact = j.contactEvents[0] ?? null;
      const clientContacts = j.contactEvents.filter((e) => e.clientId === task.clientId).length;
      const contactDays = lastContact ? (now.getTime() - lastContact.at.getTime()) / DAY : Infinity;
      const quality = j.owners.map((o) => o.relationQuality).find(Boolean) ?? null;
      // Pressespiegel und Kontakthistorie fließen in die Auswahl ein (DECISIONS D-134)
      const score =
        topics.length * 3 +
        articles.length * 2 +
        Math.min(aboutClient.length, 5) * 3 +
        (isTarget ? 2 : 0) +
        (contactDays <= 180 ? 2 : 0) +
        (clientContacts ? 2 : 0) +
        (quality === "GUT" ? 1 : quality === "SCHWIERIG" ? -2 : 0);
      const relevant = topics.length + articles.length + aboutClient.length + (isTarget ? 1 : 0) + clientContacts > 0;
      const parts: string[] = [];
      if (articles.length) parts.push(t.journo.editor.reasonArticles(articles.length, formatDate(articles[0]!.publishedAt)));
      if (topics.length) parts.push(t.journo.editor.reasonTopics(topics.join(", ")));
      if (isTarget) parts.push(t.journo.editor.reasonTargetMedia);
      if (quality) parts.push(t.journo.editor.relation[quality]!);
      parts.push(j.owners.length ? t.journo.editor.reasonOwner(j.owners.map((o) => o.user.name.split(" ")[0]).join(", ")) : t.journo.noOwner);
      const pressLine = aboutClient.length
        ? t.journo.editor.pressLine(task.client.name, aboutClient.length, press.length, formatDate(aboutClient[0]!.publishedAt))
        : press.length
          ? t.journo.editor.pressLineOther(press.length, formatDate(press[0]!.publishedAt))
          : null;
      const contactLine = lastContact
        ? [
            t.journo.editor.contactLine(lastContact.user?.name.split(" ")[0] ?? "–", formatDate(lastContact.at), t.journo.contactHistory.kinds[lastContact.kind] ?? lastContact.kind, lastContact.client?.name ?? null),
            ...(clientContacts ? [t.journo.editor.contactCount(clientContacts, task.client.name)] : []),
          ].join(" · ")
        : null;
      return { j, score, relevant, topics, articles, aboutClient, contactDays, reason: parts.join(", "), pressLine, contactLine };
    })
    .filter((s) => s.relevant && s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);

  let ordered = scored;
  let aiOrdered = false;
  if (scored.length > 1 && task.client.aiAllowed) {
    try {
      // an die KI nur Schlüssel, Medium, Ressort, Themen und Überschriften, keine Namen und Kontaktdaten
      const kontakte = scored
        .map(
          (s, i) =>
            `K${i + 1}: ${s.j.media?.name ?? "-"}, ${s.j.desk ?? "-"}, Themen: ${s.j.topics.join(", ") || "-"}; Artikel: ${s.articles.map((a) => a.headline).join(" | ") || "-"}; ` +
            `Pressespiegel zum Kunden: ${s.aboutClient.length}; letzter Kontakt: ${Number.isFinite(s.contactDays) ? `vor ${Math.round(s.contactDays)} Tagen` : "keiner"}`,
        )
        .join("\n");
      const result = await callAi(deps, "journalist-suggestions", {
        clientIds: [task.clientId],
        vars: { text: `${task.client.name}: ${docText.slice(0, 3000)}`, zielmedien: targetMedia.join(", ") || "keine", kontakte },
      });
      const picked = result.data.suggestions.map((s) => scored[Number(s.journalistId.replace(/^K/i, "")) - 1]).filter((s): s is (typeof scored)[number] => Boolean(s));
      if (picked.length) {
        ordered = [...new Set(picked)];
        aiOrdered = true;
      }
    } catch (error) {
      if (!(error instanceof AiUnavailableError || error instanceof AiOutputError || error instanceof AiNotAllowedError)) throw error;
    }
  }
  // verifizierte zuerst, innerhalb dieser Gruppen bleibt die Reihenfolge
  const suggestions = [...ordered]
    .sort((a, b) => Number(b.j.status === "VERIFIZIERT") - Number(a.j.status === "VERIFIZIERT"))
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => ({
      id: s.j.id,
      name: `${s.j.firstName} ${s.j.lastName}`,
      media: s.j.media?.name ?? null,
      desk: s.j.desk,
      status: s.j.status,
      reason: s.reason,
      pressLine: s.pressLine,
      contactLine: s.contactLine,
      bookmarked: s.j.bookmarks.length > 0,
    }));
  return { suggestions, aiOrdered, embargoAt: task.embargoAt };
}

/** Kontakt für diesen Text vormerken oder die Vormerkung lösen (BRIEFING 7.5). */
export async function toggleBookmark(deps: Deps, actor: Actor, taskId: string, journalistId: string) {
  assert(actor.active);
  if (!uuid.safeParse(taskId).success || !uuid.safeParse(journalistId).success) throw new NotFoundError(t.errors.notFound);
  const document = await deps.db.document.findUnique({ where: { taskId } });
  const journalist = await deps.db.journalist.findUnique({ where: { id: journalistId } });
  if (!document || !journalist) throw new NotFoundError(t.errors.notFound);
  const existing = await deps.db.contactBookmark.findUnique({ where: { journalistId_documentId: { journalistId, documentId: document.id } } });
  if (existing) {
    await deps.db.contactBookmark.delete({ where: { id: existing.id } });
    return false;
  }
  await deps.db.contactBookmark.create({ data: { journalistId, documentId: document.id, createdBy: actor.id, updatedBy: actor.id } });
  return true;
}

/** Vorgemerkte Kontakte als Empfängervorschlag beim Versand an Medien (ohne Kontaktdaten). */
export async function bookmarkedRecipients(deps: Pick<Deps, "db">, documentId: string) {
  const bookmarks = await deps.db.contactBookmark.findMany({
    where: { documentId },
    include: { journalist: { select: { id: true, firstName: true, lastName: true, media: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  return bookmarks.map((b) => ({
    id: b.journalist.id,
    label: `${b.journalist.firstName} ${b.journalist.lastName}${b.journalist.media ? ` (${b.journalist.media.name})` : ""}`,
  }));
}
