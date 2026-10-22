import { z } from "zod";
import { t } from "@/i18n";
import { callAi } from "@/lib/ai/service";
import type { SectionContent } from "@/lib/domain/clients/profile-sections";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { assert, canEditDocument, type NamedActor } from "@/lib/domain/permissions";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import { blockTexts, type JSONNode } from "@/lib/editor/content";
import type { AiInsertionKind } from "@/lib/generated/prisma/client";
import { loadDocument } from "./service";

/**
 * KI-Bausteine im Text (BRIEFING 8.2): Headline, Zitat, Lead. Die KI liefert Vorschläge; erst das
 * Einfügen legt einen offenen Baustein an, der bis zur Übernahme die Freigabeanfrage sperrt.
 */
const uuid = z.uuid();

async function writeContext(deps: Deps, actor: NamedActor, taskId: string) {
  if (!uuid.safeParse(taskId).success) throw new NotFoundError(t.errors.notFound);
  const loaded = await loadDocument(deps.db, taskId);
  const ctx = await loadPermissionContext(deps.db, actor.id);
  assert(
    canEditDocument(actor, ctx, {
      clientId: loaded.task.clientId,
      ownerId: loaded.task.ownerId,
      status: loaded.task.status,
      claimedBy: loaded.openApproval?.claimedBy ?? null,
    }),
  );
  return loaded;
}

async function coreMessages(deps: Deps, clientId: string): Promise<string> {
  const row = await deps.db.clientProfileSection.findUnique({ where: { clientId_key: { clientId, key: "ziele_kernbotschaften" } } });
  const list = ((row?.content ?? {}) as SectionContent).kernbotschaften;
  return Array.isArray(list) && list.length ? list.map((m) => `- ${typeof m === "string" ? m : m.text}`).join("\n") : "keine hinterlegt";
}

function textOf(content: unknown): string {
  return blockTexts(content as JSONNode)
    .filter((b) => b.text)
    .map((b) => `${b.label}: ${b.text}`)
    .join("\n\n");
}

export async function suggestHeadlines(deps: Deps, actor: NamedActor, taskId: string) {
  const { task, document } = await writeContext(deps, actor, taskId);
  const result = await callAi(deps, "headlines", {
    clientIds: [task.clientId],
    vars: { form: document.documentFormat.name, kernbotschaften: await coreMessages(deps, task.clientId), text: textOf(document.content) },
  });
  return { options: result.data.headlines, model: result.model, promptVersion: result.promptVersion };
}

export async function suggestQuote(deps: Deps, actor: NamedActor, taskId: string, speakerId: string) {
  const { task, document } = await writeContext(deps, actor, taskId);
  const speaker = uuid.safeParse(speakerId).success ? await deps.db.speaker.findFirst({ where: { id: speakerId, clientId: task.clientId } }) : null;
  if (!speaker) throw new DomainError(t.ai.noSpeakers);
  const result = await callAi(deps, "quote", {
    clientIds: [task.clientId],
    vars: {
      sprecher: `${speaker.name}, ${speaker.function}${speaker.topics.length ? ` (Themen: ${speaker.topics.join(", ")})` : ""}`,
      kernbotschaften: await coreMessages(deps, task.clientId),
      text: textOf(document.content),
    },
  });
  return { options: [result.data.quote], model: result.model, promptVersion: result.promptVersion, quoteNeedsClientApproval: speaker.quoteNeedsClientApproval };
}

export async function suggestLead(deps: Deps, actor: NamedActor, taskId: string) {
  const { task, document } = await writeContext(deps, actor, taskId);
  const blocks = blockTexts(document.content as JSONNode);
  const result = await callAi(deps, "lead", {
    clientIds: [task.clientId],
    vars: { lead: blocks.find((b) => b.key === "lead")?.text ?? "", haupttext: blocks.find((b) => b.key === "haupttext")?.text ?? "" },
  });
  return { options: [result.data.lead], model: result.model, promptVersion: result.promptVersion };
}

const insertionSchema = z.object({
  kind: z.enum(["HEADLINE", "ZITAT", "LEAD", "SONSTIGES"]),
  model: z.string().trim().min(1).max(120),
  promptVersion: z.string().trim().min(1).max(120),
});

/** Beim Einfügen entsteht der offene Baustein; die Markierung im Text trägt seine ID. */
export async function createInsertion(deps: Deps, actor: NamedActor, taskId: string, raw: { kind: AiInsertionKind; model: string; promptVersion: string }) {
  const { task, document } = await writeContext(deps, actor, taskId);
  if (!task.client.aiAllowed) throw new DomainError(t.ai.disabledForClient);
  const input = insertionSchema.parse(raw);
  return deps.db.aiInsertion.create({ data: { documentId: document.id, ...input, createdBy: actor.id, updatedBy: actor.id } });
}

async function openInsertion(deps: Deps, actor: NamedActor, taskId: string, insertionId: string) {
  const { document } = await writeContext(deps, actor, taskId);
  const insertion = uuid.safeParse(insertionId).success ? await deps.db.aiInsertion.findFirst({ where: { id: insertionId, documentId: document.id } }) : null;
  if (!insertion) throw new NotFoundError(t.errors.notFound);
  return insertion;
}

/** "Übernehmen": ein Mensch nimmt den Baustein an; im Verlauf nachvollziehbar (BRIEFING 8.2). */
export async function acceptInsertion(deps: Deps, actor: NamedActor, taskId: string, insertionId: string) {
  const insertion = await openInsertion(deps, actor, taskId, insertionId);
  if (insertion.status !== "OFFEN") return;
  await deps.db.aiInsertion.update({
    where: { id: insertion.id },
    data: { status: "ANGENOMMEN", acceptedBy: actor.id, acceptedAt: deps.now(), updatedBy: actor.id },
  });
}

/** "Verwerfen" entfernt den Baustein; der Text wird im Editor gelöscht. */
export async function discardInsertion(deps: Deps, actor: NamedActor, taskId: string, insertionId: string) {
  const insertion = await openInsertion(deps, actor, taskId, insertionId);
  if (insertion.status !== "OFFEN") return;
  await deps.db.aiInsertion.update({ where: { id: insertion.id }, data: { status: "VERWORFEN", updatedBy: actor.id } });
}
