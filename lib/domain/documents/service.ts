import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { t } from "@/i18n";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { notify } from "@/lib/domain/notifications";
import { assert, canEditDocument, canEditTask, type NamedActor } from "@/lib/domain/permissions";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import { computePriority } from "@/lib/domain/tasks/rules";
import { blockTexts, type JSONNode } from "@/lib/editor/content";
import { baseExtensions } from "@/lib/editor/extensions";
import type { Prisma, PrismaClient, TaskStatus, VersionReason } from "@/lib/generated/prisma/client";
import { parseBlocks } from "./template";
import { importDocx } from "./word-import";

type Db = PrismaClient | Prisma.TransactionClient;

/** Die Sperre fällt nach 10 Minuten ohne Eingabe (BRIEFING 7.3). */
export const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

const schema = getSchema(baseExtensions());

export async function loadDocument(db: PrismaClient, taskId: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      client: true,
      owner: { select: { id: true, name: true } },
      project: true,
      document: { include: { documentFormat: true } },
    },
  });
  if (!task?.document) throw new NotFoundError(t.errors.notFound);
  const openApproval = await db.approval.findFirst({
    where: { documentId: task.document.id, decision: null },
    orderBy: { requestedAt: "desc" },
  });
  return { task, document: task.document, openApproval };
}

export type LoadedDocument = Awaited<ReturnType<typeof loadDocument>>;

/** Inhaber der Sperre, solange die letzte Eingabe weniger als 10 Minuten her ist. */
export function activeLockHolder(doc: { lockedBy: string | null; lockedAt: Date | null }, now: Date): string | null {
  if (!doc.lockedBy || !doc.lockedAt) return null;
  return now.getTime() - doc.lockedAt.getTime() < LOCK_TIMEOUT_MS ? doc.lockedBy : null;
}

async function editContext(deps: Deps, actor: NamedActor, taskId: string) {
  const loaded = await loadDocument(deps.db, taskId);
  const ctx = await loadPermissionContext(deps.db, actor.id);
  const canEdit = canEditDocument(actor, ctx, {
    clientId: loaded.task.clientId,
    ownerId: loaded.task.ownerId,
    status: loaded.task.status,
    claimedBy: loaded.openApproval?.claimedBy ?? null,
  });
  return { ...loaded, ctx, canEdit };
}

/** Version anlegen: bei jedem Statuswechsel automatisch, zusätzlich manuell (BRIEFING 7.3). */
export async function createVersion(
  db: Db,
  input: { documentId: string; content: Prisma.InputJsonValue; reason: VersionReason; status: TaskStatus | null; actorId: string },
) {
  const last = await db.documentVersion.findFirst({ where: { documentId: input.documentId }, orderBy: { number: "desc" } });
  const version = await db.documentVersion.create({
    data: {
      documentId: input.documentId,
      number: (last?.number ?? 0) + 1,
      content: input.content,
      reason: input.reason,
      status: input.status,
      createdBy: input.actorId,
      updatedBy: input.actorId,
    },
  });
  await db.document.update({ where: { id: input.documentId }, data: { currentVersionId: version.id } });
  return version;
}

/** Statuswechsel einer Dokument-Aufgabe mit automatischer Version (BRIEFING 6.3, 7.3). */
export async function changeDocumentStatus(
  db: Db,
  input: { taskId: string; documentId: string; content: Prisma.InputJsonValue; status: TaskStatus; actorId: string; completedAt?: Date | null },
) {
  await db.task.update({
    where: { id: input.taskId },
    data: { status: input.status, updatedBy: input.actorId, ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}) },
  });
  return createVersion(db, { documentId: input.documentId, content: input.content, reason: "STATUSWECHSEL", status: input.status, actorId: input.actorId });
}

/** Sperre übernehmen, wenn frei, abgelaufen oder schon die eigene. */
async function takeLock(deps: Deps, actor: NamedActor, doc: { id: string; lockedBy: string | null; lockedAt: Date | null }) {
  const now = deps.now();
  const holder = activeLockHolder(doc, now);
  if (holder && holder !== actor.id) return false;
  await deps.db.document.update({
    where: { id: doc.id },
    data: { lockedBy: actor.id, lockedAt: now, ...(holder === actor.id ? {} : { lockRequestedBy: null, lockRequestedAt: null }) },
  });
  return true;
}

/**
 * Editor öffnen: wer schreiben darf, sperrt das Dokument, sofern niemand sonst schreibt.
 * Andere lesen mit (BRIEFING 7.3).
 */
export async function openForEditing(
  deps: Deps,
  actor: NamedActor,
  taskId: string,
): Promise<{ editing: boolean; holderId: string | null; holderName: string | null }> {
  const { document, canEdit } = await editContext(deps, actor, taskId);
  const editing = canEdit ? await takeLock(deps, actor, document) : false;
  const holderId = editing ? actor.id : activeLockHolder(document, deps.now());
  const holder = holderId ? await deps.db.user.findUnique({ where: { id: holderId }, select: { name: true } }) : null;
  return { editing, holderId, holderName: holder?.name ?? null };
}

/** Prüft, dass der Inhalt zum Schema passt und die Bausteine der Vorlage unverändert sind. */
export function validateContent(content: unknown, expectedKeys: string[]): JSONNode {
  let node: PMNode;
  try {
    node = PMNode.fromJSON(schema, content);
    node.check();
  } catch {
    throw new DomainError(t.documents.errors.contentInvalid);
  }
  const keys: string[] = [];
  node.forEach((block) => keys.push(String(block.attrs.key)));
  if (keys.join("|") !== expectedKeys.join("|")) throw new DomainError(t.documents.errors.structureChanged);
  return node.toJSON() as JSONNode;
}

function blockKeysOf(content: unknown): string[] {
  return ((content as JSONNode).content ?? []).map((b) => String(b.attrs?.key ?? ""));
}

/**
 * Automatische Speicherung (BRIEFING 7.3): nur mit Schreibrecht und Sperre. Die erste Eingabe
 * des Owners setzt Offen bzw. Änderungen angefordert auf In Bearbeitung (DECISIONS D-057).
 */
export async function saveContent(deps: Deps, actor: NamedActor, taskId: string, content: unknown): Promise<{ savedAt: Date }> {
  const { task, document, canEdit } = await editContext(deps, actor, taskId);
  assert(canEdit);
  const holder = activeLockHolder(document, deps.now());
  if (holder && holder !== actor.id) throw new DomainError(t.documents.errors.lockedByOther);
  const clean = validateContent(content, blockKeysOf(document.content));
  const now = deps.now();
  let updatedAt = now;
  await deps.db.$transaction(async (tx) => {
    const updated = await tx.document.update({
      where: { id: document.id },
      data: { content: clean as Prisma.InputJsonValue, lockedBy: actor.id, lockedAt: now, updatedBy: actor.id },
    });
    updatedAt = updated.updatedAt;
    if (task.status === "OFFEN" || task.status === "AENDERUNGEN_ANGEFORDERT") {
      await changeDocumentStatus(tx, { taskId, documentId: document.id, content: clean as Prisma.InputJsonValue, status: "IN_BEARBEITUNG", actorId: actor.id });
    }
  });
  return { savedAt: updatedAt };
}

/** Sperre lösen, beim Schließen oder auf Anfrage (BRIEFING 7.3). */
export async function releaseLock(deps: Deps, actor: NamedActor, taskId: string): Promise<void> {
  const { document } = await loadDocument(deps.db, taskId);
  if (document.lockedBy !== actor.id) return;
  await deps.db.document.update({ where: { id: document.id }, data: { lockedBy: null, lockedAt: null } });
}

/** Bearbeitung anfordern: der Sperrinhaber bekommt eine Benachrichtigung (BRIEFING 7.3, 7.9). */
export async function requestLock(deps: Deps, actor: NamedActor, taskId: string): Promise<void> {
  const { task, document, canEdit } = await editContext(deps, actor, taskId);
  assert(canEdit);
  const holder = activeLockHolder(document, deps.now());
  if (!holder || holder === actor.id) return;
  await deps.db.document.update({ where: { id: document.id }, data: { lockRequestedBy: actor.id, lockRequestedAt: deps.now() } });
  await notify(deps, {
    userId: holder,
    kind: "LOCK_REQUESTED",
    title: t.notifications.lockRequested(actor.name, task.title),
    link: `/aufgaben/${task.id}`,
    push: false,
  });
}

/** Änderungsverfolgung ein- und ausschalten: der Owner (für andere ist sie immer an). */
export async function setTrackChanges(deps: Deps, actor: NamedActor, taskId: string, on: boolean): Promise<void> {
  const { task, document } = await loadDocument(deps.db, taskId);
  assert(task.ownerId === actor.id);
  await deps.db.document.update({ where: { id: document.id }, data: { trackChangesOn: on, updatedBy: actor.id } });
}

/** Manuelle Version (BRIEFING 7.3). */
export async function saveManualVersion(deps: Deps, actor: NamedActor, taskId: string) {
  const { task, document, ctx } = await editContext(deps, actor, taskId);
  assert(canEditTask(actor, ctx, task) || document.lockedBy === actor.id);
  return createVersion(deps.db, { documentId: document.id, content: document.content as Prisma.InputJsonValue, reason: "MANUELL", status: task.status, actorId: actor.id });
}

/**
 * Word-Import (BRIEFING 7.3, 6.5): beim Schreiben ersetzt er den Inhalt; beim Kunden ist er der
 * Rückläufer und setzt den Text zurück auf In Bearbeitung, mit neuer Freigabe.
 */
export async function importWord(deps: Deps, actor: NamedActor, taskId: string, file: { name: string; mimeType: string; data: Uint8Array }) {
  const { task, document, canEdit, ctx } = await editContext(deps, actor, taskId);
  const fromClient = task.status === "BEIM_KUNDEN";
  assert(fromClient ? canEditTask(actor, ctx, task) : canEdit);
  if (!fromClient) {
    const holder = activeLockHolder(document, deps.now());
    if (holder && holder !== actor.id) throw new DomainError(t.documents.errors.lockedByOther);
  }
  if (!file.name.toLowerCase().endsWith(".docx")) throw new DomainError(t.documents.errors.notDocx);
  let content: JSONNode;
  try {
    content = await importDocx(file.data, parseBlocks(document.documentFormat.blocks));
  } catch {
    throw new DomainError(t.documents.errors.notDocx);
  }
  const clean = validateContent(content, blockKeysOf(document.content)) as Prisma.InputJsonValue;

  const storageKey = `tasks/${task.id}/${crypto.randomUUID()}`;
  await deps.files.put(storageKey, file.data, file.mimeType);
  await deps.db.$transaction(async (tx) => {
    await tx.file.create({
      data: { storageKey, name: file.name, mimeType: file.mimeType, size: file.data.byteLength, clientId: task.clientId, taskId: task.id, uploadedBy: actor.id, createdBy: actor.id },
    });
    await tx.document.update({ where: { id: document.id }, data: { content: clean, updatedBy: actor.id, lockedBy: fromClient ? null : actor.id, lockedAt: fromClient ? null : deps.now() } });
    const status: TaskStatus = task.status === "OFFEN" || fromClient || task.status === "AENDERUNGEN_ANGEFORDERT" ? "IN_BEARBEITUNG" : task.status;
    if (status !== task.status) await tx.task.update({ where: { id: task.id }, data: { status, updatedBy: actor.id } });
    await createVersion(tx, { documentId: document.id, content: clean, reason: "IMPORT", status, actorId: actor.id });
  });
}

// ------------------------------------------------------------- Kommentare (BRIEFING 7.3)

/** Erwähnte Nutzer: "@Vorname" oder "@Vorname Nachname" im Kommentar. */
async function mentionedUsers(db: PrismaClient, body: string) {
  if (!body.includes("@")) return [];
  const users = await db.user.findMany({ where: { active: true }, select: { id: true, name: true } });
  const lower = body.toLowerCase();
  return users.filter((u) => lower.includes(`@${u.name.toLowerCase()}`) || lower.includes(`@${u.name.split(" ")[0]!.toLowerCase()}`));
}

/**
 * Kommentar oder Antwort. Ein neuer Thread mit Textanker setzt voraus, dass der Anker im Text steht
 * (Markierung "comment" aus dem Editor, nur mit Schreibrecht); ohne Anker betrifft er den ganzen Text
 * (DECISIONS D-058). Owner und Erwähnte werden benachrichtigt (BRIEFING 7.9).
 */
export async function addComment(
  deps: Deps,
  actor: NamedActor,
  taskId: string,
  input: { body: string; threadId?: string | null; anchorThreadId?: string | null; quote?: string | null },
) {
  const body = input.body.trim();
  if (!body) throw new DomainError(t.documents.errors.commentEmpty);
  if (body.length > 4000) throw new DomainError(t.documents.errors.commentTooLong);
  const { task, document } = await loadDocument(deps.db, taskId);
  assert(actor.active);

  const threadId = input.threadId ?? null;
  if (threadId) {
    const root = await deps.db.comment.findFirst({ where: { documentId: document.id, id: threadId } });
    if (!root) throw new NotFoundError(t.errors.notFound);
  }
  const id = threadId ? crypto.randomUUID() : input.anchorThreadId ?? crypto.randomUUID();
  const comment = await deps.db.comment.create({
    data: {
      id,
      documentId: document.id,
      threadId: threadId ?? id,
      body,
      anchor: !threadId && input.anchorThreadId ? { threadId: input.anchorThreadId, quote: input.quote?.slice(0, 300) ?? "" } : threadId ? undefined : { wholeText: true },
      createdBy: actor.id,
      updatedBy: actor.id,
    },
  });

  const recipients = new Set<string>([task.ownerId, ...(await mentionedUsers(deps.db, body)).map((u) => u.id)]);
  if (threadId) {
    const participants = await deps.db.comment.findMany({ where: { threadId }, select: { createdBy: true } });
    participants.forEach((p) => p.createdBy && recipients.add(p.createdBy));
  }
  recipients.delete(actor.id);
  for (const userId of recipients) {
    await notify(deps, { userId, kind: "COMMENT", title: t.notifications.comment(actor.name, task.title), link: `/aufgaben/${task.id}`, push: false });
  }
  return comment;
}

export async function resolveThread(deps: Deps, actor: NamedActor, taskId: string, threadId: string, resolved: boolean) {
  assert(actor.active);
  const { document } = await loadDocument(deps.db, taskId);
  await deps.db.comment.updateMany({
    where: { documentId: document.id, threadId },
    data: resolved ? { resolvedAt: deps.now(), resolvedBy: actor.id } : { resolvedAt: null, resolvedBy: null },
  });
}

/** Zustand für das Mitlesen (Abfrage alle paar Sekunden). */
export async function documentState(deps: Deps, actor: NamedActor, taskId: string) {
  const { task, document, openApproval, canEdit } = await editContext(deps, actor, taskId);
  const now = deps.now();
  const holderId = activeLockHolder(document, now);
  const names = await deps.db.user.findMany({
    where: { id: { in: [holderId, document.lockRequestedBy, openApproval?.claimedBy].filter((x): x is string => !!x) } },
    select: { id: true, name: true },
  });
  const name = (id: string | null | undefined) => names.find((u) => u.id === id)?.name ?? null;
  return {
    status: task.status,
    priority: computePriority(task.dueAt, task.priorityManual, now),
    content: document.content as JSONNode,
    updatedAt: document.updatedAt.toISOString(),
    lock: { holderId, holderName: name(holderId), requestedById: holderId === actor.id ? document.lockRequestedBy : null, requestedByName: holderId === actor.id ? name(document.lockRequestedBy) : null },
    claim: openApproval ? { claimedById: openApproval.claimedBy, claimedByName: name(openApproval.claimedBy) } : null,
    canEdit,
    commentCount: await deps.db.comment.count({ where: { documentId: document.id } }),
  };
}

export function plainBlocks(content: unknown) {
  return blockTexts(content as JSONNode);
}
