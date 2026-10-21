import { t } from "@/i18n";
import { AiNotAllowedError, AiOutputError, AiUnavailableError } from "@/lib/ai/errors";
import { callAi } from "@/lib/ai/service";
import { profileForAi } from "@/lib/domain/clients/profile";
import type { Deps } from "@/lib/domain/deps";
import { parseBlocks } from "@/lib/domain/documents/template";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { mediaByName } from "@/lib/domain/journo/contacts";
import { notify } from "@/lib/domain/notifications";
import { assert, canEditContact, canWorkOnMonitoring, type NamedActor } from "@/lib/domain/permissions";
import { createTask } from "@/lib/domain/tasks/service";
import type { JSONMark, JSONNode } from "@/lib/editor/content";
import type { Article, ArticleActionKind, Prisma, ServiceCategory, TaskCategory } from "@/lib/generated/prisma/client";
import { addWorkdays, atTime, dateKey, formatDate, formatLongDate, isWorkday } from "@/lib/time";
import { internalClientId } from "@/lib/domain/clients/internal";
import { requireArticle } from "./articles";

const FULL_TEXT_FOR_AI = 6000;

export type DraftKind = "EINSCHAETZUNG" | "LINKEDIN_KOMMENTAR" | "NEWSHOOK_PITCH";

/** Darstellungsform, Kategorie und zählende Leistung je Aktion (BRIEFING 7.6 Schritt 6, DECISIONS D-105). */
const DRAFTS: Record<DraftKind, { format: string; category: TaskCategory; service: ServiceCategory | null; art: string }> = {
  EINSCHAETZUNG: { format: "EINSCHAETZUNG", category: "MEDIENARBEIT", service: null, art: "Einschätzung für den Kunden" },
  LINKEDIN_KOMMENTAR: { format: "LINKEDIN_KOMMENTAR", category: "DIGITALE_KOMMUNIKATION", service: "LINKEDIN", art: "LinkedIn-Kommentar" },
  NEWSHOOK_PITCH: { format: "MEDIEN_PITCH", category: "MEDIENARBEIT", service: "MEDIEN_PITCH", art: "Newshook-Pitch an den Autor oder das Ressort" },
};

// ------------------------------------------------------------- Bausteine als Editor-JSON

const text = (value: string, marks?: JSONMark[]): JSONNode => ({ type: "text", text: value, ...(marks?.length ? { marks } : {}) });
const para = (...nodes: JSONNode[]): JSONNode => (nodes.length ? { type: "paragraph", content: nodes } : { type: "paragraph" });
const aiMark = (id: string): JSONMark => ({ type: "aiInsertion", attrs: { id, kind: "SONSTIGES" } });

function block(def: { key: string; label: string; required: boolean }, paragraphs: JSONNode[]): JSONNode {
  return { type: "templateBlock", attrs: { key: def.key, label: def.label, required: def.required }, content: paragraphs.length ? paragraphs : [para()] };
}

/** Angaben zum Bezugsartikel: Fakten, kein KI-Text. */
function reference(a: Article): string[] {
  return [a.headline, [a.mediaName, formatDate(a.publishedAt), a.authorName, a.url].filter(Boolean).join(", ")];
}

function articleForAi(a: Article): string {
  return [
    `Headline: ${a.headline}`,
    `Medium: ${a.mediaName}, ${formatDate(a.publishedAt)}${a.authorName ? `, ${a.authorName}` : ""}`,
    a.teaser ? `Teaser: ${a.teaser}` : null,
    a.fullTextPasted ? `Volltext: ${a.fullTextPasted.slice(0, FULL_TEXT_FOR_AI)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const aiErrors = (e: unknown) => e instanceof AiUnavailableError || e instanceof AiOutputError || e instanceof AiNotAllowedError;

async function requireSelection(deps: Deps, articleId: string, clientId: string) {
  const article = await requireArticle(deps.db, articleId);
  const relevance = await deps.db.articleRelevance.findUnique({ where: { articleId_clientId: { articleId, clientId } }, include: { client: true } });
  if (!relevance?.selected) throw new DomainError(t.monitoring.errors.notSelected);
  return { article, client: relevance.client };
}

/** LinkedIn-Kommentar nur, wenn der Kunde eine vereinbarte Leistung LinkedIn hat (BRIEFING 7.6). */
export async function linkedinAvailable(deps: Pick<Deps, "db">, clientId: string): Promise<boolean> {
  return (await deps.db.agreedService.count({ where: { clientId, category: "LINKEDIN" } })) > 0;
}

/**
 * Einschätzung, LinkedIn-Kommentar oder Newshook-Pitch (BRIEFING 7.6 Schritte 6 und 7): eine Aufgabe
 * in der Redaktion mit Entwurf, der vollständig als ein KI-Baustein markiert ist (8.2). Ohne KI
 * entsteht die Aufgabe mit dem Bezugsartikel und leeren Bausteinen.
 */
export async function createArticleDraft(deps: Deps, actor: NamedActor, articleId: string, clientId: string, kind: DraftKind) {
  assert(canWorkOnMonitoring(actor));
  const { article, client } = await requireSelection(deps, articleId, clientId);
  const spec = DRAFTS[kind];
  if (kind === "LINKEDIN_KOMMENTAR" && !(await linkedinAvailable(deps, clientId))) throw new DomainError(t.monitoring.errors.linkedinUnavailable);
  const format = await deps.db.documentFormat.findUniqueOrThrow({ where: { key: spec.format } });
  const blocks = parseBlocks(format.blocks);
  const now = deps.now();
  const services = spec.service ? await deps.db.agreedService.findMany({ where: { clientId, category: spec.service, periodStart: { lte: now }, periodEnd: { gte: now } } }) : [];
  const media = article.mediaId ? await deps.db.media.findUnique({ where: { id: article.mediaId } }) : null;
  const author = article.journalistId ? await deps.db.journalist.findUnique({ where: { id: article.journalistId }, select: { desk: true } }) : null;

  const task = await createTask(deps, actor, {
    clientId,
    category: spec.category,
    type: "DOKUMENT",
    format: spec.format,
    title: t.monitoring.actions.titles[kind](article.headline).slice(0, 200),
    ownerId: actor.id,
    dueAt: atTime(addWorkdays(dateKey(now), 1), "12:00"),
    agreedServiceId: services.length === 1 ? services[0]!.id : null,
    description: kind === "NEWSHOOK_PITCH" ? t.monitoring.actions.pitchTo(article.authorName ?? "", media?.name ?? article.mediaName, author?.desk ?? "") : null,
  });
  const document = await deps.db.document.findUniqueOrThrow({ where: { taskId: task.id } });

  let draft: Record<string, string> = {};
  let insertionId: string | null = null;
  let aiNotice: string | null = null;
  if (client.aiAllowed) {
    try {
      const result = await callAi(deps, "article-draft", {
        clientIds: [clientId],
        vars: {
          art: spec.art,
          bausteine: blocks.filter((b) => b.key !== "bezugsartikel").map((b) => `${b.key}: ${b.label}`).join("\n"),
          profil: await profileForAi(deps.db, clientId, ["ziele_kernbotschaften", "sprecher", "themen_suchbegriffe", "tone_of_voice", "styleguide", "tabuthemen"]),
          artikel: articleForAi(article),
        },
      });
      draft = result.data.blocks;
      insertionId = (await deps.db.aiInsertion.create({
        data: { documentId: document.id, kind: "SONSTIGES", model: result.model, promptVersion: result.promptVersion, createdBy: actor.id, updatedBy: actor.id },
      })).id;
    } catch (error) {
      if (!aiErrors(error)) throw error;
      aiNotice = error.message;
    }
  } else {
    aiNotice = t.ai.disabledForClient;
  }

  const content: JSONNode = {
    type: "doc",
    content: blocks.map((b) => {
      if (b.key === "bezugsartikel") return block(b, reference(article).map((line) => para(text(line))));
      const value = draft[b.key]?.trim();
      return block(b, value && insertionId ? value.split(/\n{2,}/).map((p) => para(text(p, [aiMark(insertionId!)]))) : []);
    }),
  };
  await deps.db.document.update({ where: { id: document.id }, data: { content: content as Prisma.InputJsonValue, updatedBy: actor.id } });
  await deps.db.articleAction.create({ data: { articleId, clientId, kind, resultTaskId: task.id, createdBy: actor.id, updatedBy: actor.id } });
  return { taskId: task.id, aiNotice };
}

/**
 * "Autor in Journo Hub übernehmen" (BRIEFING 7.6): neuer Kontakt mit dem Label Pressespiegel, bleibt
 * unverifiziert; wer übernimmt, wird Owner. Alle Artikel des Autors bei diesem Medium werden zugeordnet.
 */
export async function takeOverAuthor(deps: Deps, actor: NamedActor, articleId: string, clientId: string) {
  assert(canWorkOnMonitoring(actor) && canEditContact(actor));
  const { article } = await requireSelection(deps, articleId, clientId);
  if (article.journalistId) throw new DomainError(t.monitoring.actions.authorKnown);
  const name = article.authorName?.trim();
  if (!name || name.split(/\s+/).length < 2) throw new DomainError(t.monitoring.actions.noAuthor);
  const parts = name.split(/\s+/);
  const lastName = parts.pop()!;
  const now = deps.now();
  const journalist = await deps.db.$transaction(async (tx) => {
    const mediaId = article.mediaId ?? (await mediaByName(tx, article.mediaName, actor.id));
    const created = await tx.journalist.create({
      data: { firstName: parts.join(" "), lastName, mediaId, status: "PRESSESPIEGEL", source: "PRESSESPIEGEL", lastActivityAt: now, createdBy: actor.id, updatedBy: actor.id },
    });
    await tx.contactOwner.create({ data: { journalistId: created.id, userId: actor.id, since: now, createdBy: actor.id, updatedBy: actor.id } });
    await tx.article.updateMany({
      where: { journalistId: null, authorName: { equals: name, mode: "insensitive" }, mediaName: { equals: article.mediaName, mode: "insensitive" } },
      data: { journalistId: created.id, mediaId },
    });
    await tx.articleAction.create({ data: { articleId, clientId, kind: "KONTAKT_UEBERNEHMEN", resultJournalistId: created.id, createdBy: actor.id, updatedBy: actor.id } });
    return created;
  });
  return { journalistId: journalist.id };
}

/**
 * "Pressespiegel erstellen" (BRIEFING 7.6 Schritt 8, 13.9): ein Dokument der Darstellungsform
 * Pressespiegel pro Kunde mit allen aufgenommenen Artikeln, die noch in keinem Pressespiegel stehen.
 * Kurzfassung in eigenen Worten als KI-Baustein je Artikel, Einschätzung schreibt der Mensch (DECISIONS D-104).
 */
export async function createPressReview(deps: Deps, actor: NamedActor, clientId: string) {
  assert(canWorkOnMonitoring(actor));
  const client = await deps.db.client.findFirst({ where: { id: clientId, status: "AKTIV", isInternal: false } });
  if (!client) throw new NotFoundError(t.errors.notFound);
  const relevances = await deps.db.articleRelevance.findMany({
    where: { clientId, selected: true, article: { actions: { none: { clientId, kind: "PRESSESPIEGEL" } } } },
    include: { article: true },
  });
  if (!relevances.length) throw new DomainError(t.monitoring.review.none);
  const articles = relevances
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.article.publishedAt.getTime() - a.article.publishedAt.getTime())
    .map((r) => r.article);
  const now = deps.now();
  const format = await deps.db.documentFormat.findUniqueOrThrow({ where: { key: "PRESSESPIEGEL" } });
  const blocks = parseBlocks(format.blocks);
  const r = t.monitoring.review;

  const task = await createTask(deps, actor, {
    clientId,
    category: "MEDIENARBEIT",
    type: "DOKUMENT",
    format: "PRESSESPIEGEL",
    title: r.title(client.name, formatDate(now)),
    ownerId: actor.id,
    dueAt: new Date(now.getTime() + 2 * 3_600_000),
  });
  const document = await deps.db.document.findUniqueOrThrow({ where: { taskId: task.id } });

  const paragraphs: JSONNode[] = [];
  for (const [i, a] of articles.entries()) {
    let summary: JSONNode = text(r.summaryPlaceholder);
    if (client.aiAllowed) {
      try {
        const result = await callAi(deps, "summary", { clientIds: [clientId], vars: { artikel: articleForAi(a) } });
        const insertion = await deps.db.aiInsertion.create({
          data: { documentId: document.id, kind: "SONSTIGES", model: result.model, promptVersion: result.promptVersion, createdBy: actor.id, updatedBy: actor.id },
        });
        summary = text(result.data.summary, [aiMark(insertion.id)]);
      } catch (error) {
        if (!aiErrors(error)) throw error;
      }
    }
    paragraphs.push(
      para(text(`${i + 1}. ${a.headline}`, [{ type: "bold" }])),
      para(text([a.mediaName, formatDate(a.publishedAt), a.authorName, a.url].filter(Boolean).join(", "))),
      para(text(r.summary), summary),
      para(text(r.assessment), text(r.assessmentPlaceholder)),
    );
  }
  const content: JSONNode = {
    type: "doc",
    content: blocks.map((b) => (b.key === "datum" ? block(b, [para(text(formatLongDate(now)))]) : b.key === "artikel" ? block(b, paragraphs) : block(b, []))),
  };
  await deps.db.document.update({ where: { id: document.id }, data: { content: content as Prisma.InputJsonValue, title: r.heading(client.name, formatLongDate(now)), updatedBy: actor.id } });
  await deps.db.articleAction.createMany({
    data: articles.map((a) => ({ articleId: a.id, clientId, kind: "PRESSESPIEGEL" as ArticleActionKind, resultTaskId: task.id, createdBy: actor.id, updatedBy: actor.id })),
  });
  return { taskId: task.id, articles: articles.length };
}

/**
 * Job: zu Dienstbeginn die Aufgabe "Pressespiegel [Datum]" für die eingetragene Person anlegen
 * (BRIEFING 7.6 Schritt 1), Frist laut Diensttyp, Standard 9:30 Uhr. Kunde ist "RP intern" (D-101).
 */
export async function createPressReviewTasks(deps: Deps): Promise<number> {
  const now = deps.now();
  const key = dateKey(now);
  if (!isWorkday(key)) return 0;
  const shifts = await deps.db.shift.findMany({
    where: { date: new Date(`${key}T00:00:00.000Z`), start: { lte: now }, shiftType: { createsTask: true } },
    include: { shiftType: true, user: true },
  });
  if (!shifts.length) return 0;
  const clientId = await internalClientId(deps.db);
  let created = 0;
  for (const shift of shifts) {
    if (!shift.user.active) continue;
    const title = t.monitoring.task.title(formatDate(now));
    if (await deps.db.task.findFirst({ where: { ownerId: shift.userId, clientId, title } })) continue;
    const task = await createTask(deps, shift.user, {
      clientId,
      category: "INTERN",
      type: "AUFGABE",
      title,
      description: t.monitoring.task.description,
      ownerId: shift.userId,
      dueAt: atTime(key, shift.shiftType.taskDueTime ?? "09:30"),
    });
    await notify(deps, { userId: shift.userId, kind: "TASK_ASSIGNED", title: t.notifications.taskAssigned(task.title), link: `/aufgaben/${task.id}`, push: false });
    created += 1;
  }
  return created;
}

