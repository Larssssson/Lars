import { t } from "@/i18n";
import { AuditAction, writeAudit } from "@/lib/domain/audit";
import type { Deps } from "@/lib/domain/deps";
import { changeDocumentStatus, loadDocument } from "@/lib/domain/documents/service";
import { DomainError } from "@/lib/domain/errors";
import { notify } from "@/lib/domain/notifications";
import { assert, canApproveText, canEditTask, canRequestApproval, hasApprovalRight, type NamedActor } from "@/lib/domain/permissions";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import { approversForClient } from "@/lib/domain/permissions/queries";
import { computePriority } from "@/lib/domain/tasks/rules";
import type { Prisma } from "@/lib/generated/prisma/client";
import { formatDateTime } from "@/lib/time";

/** Fehler, wenn keine Prüfung lief und der Owner noch nicht bestätigt hat (BRIEFING 6.3). */
export class CheckConfirmationRequired extends DomainError {
  constructor() {
    super(t.approvals.confirmWithoutCheck);
    this.name = "CheckConfirmationRequired";
  }
}

function isUrgent(task: { dueAt: Date; priorityManual: "DRINGEND" | null }, now: Date) {
  return computePriority(task.dueAt, task.priorityManual, now) === "DRINGEND";
}

function pushBody(clientName: string, title: string, dueAt: Date) {
  return t.notifications.pushBody(clientName, title, formatDateTime(dueAt));
}

/**
 * Freigabe anfragen (BRIEFING 6.4 Schritt 1). Vorbelegt: bevorzugter Freigeber, sonst alle
 * Freigabeberechtigten des Kunden außer dem Owner. Gesperrt, solange KI-Bausteine offen sind (6.3).
 */
export async function requestApproval(
  deps: Deps,
  actor: NamedActor,
  taskId: string,
  input: { approverIds?: string[]; note?: string | null; confirmWithoutCheck?: boolean },
) {
  const { task, document } = await loadDocument(deps.db, taskId);
  assert(canRequestApproval(actor, task));
  if (!["IN_BEARBEITUNG", "AENDERUNGEN_ANGEFORDERT"].includes(task.status)) throw new DomainError(t.approvals.errors.notRequestable);
  if (await deps.db.aiInsertion.count({ where: { documentId: document.id, status: "OFFEN" } })) {
    throw new DomainError(t.approvals.errors.openAiBlocks);
  }
  const checked = await deps.db.checkRun.findFirst({ where: { documentId: document.id }, orderBy: { createdAt: "desc" } });
  if (!checked && !input.confirmWithoutCheck) throw new CheckConfirmationRequired();

  const eligible = (await approversForClient(deps.db, task.clientId)).filter((a) => a.id !== task.ownerId);
  const fallback = task.preferredApproverId && eligible.some((e) => e.id === task.preferredApproverId) ? [task.preferredApproverId] : eligible.map((e) => e.id);
  const approverIds = input.approverIds?.length ? input.approverIds : fallback;
  if (approverIds.length === 0 || approverIds.some((id) => !eligible.some((e) => e.id === id))) {
    throw new DomainError(t.approvals.errors.approversInvalid);
  }

  const now = deps.now();
  const approval = await deps.db.$transaction(async (tx) => {
    const version = await changeDocumentStatus(tx, {
      taskId, documentId: document.id, content: document.content as Prisma.InputJsonValue, status: "FREIGABE_ANGEFRAGT", actorId: actor.id,
    });
    // die Sperre des Owners endet mit der Anfrage
    await tx.document.update({ where: { id: document.id }, data: { lockedBy: null, lockedAt: null, lockRequestedBy: null } });
    return tx.approval.create({
      data: {
        documentId: document.id,
        versionId: version.id,
        requestedBy: actor.id,
        requestedAt: now,
        requestedApproverIds: approverIds,
        note: input.note?.trim() || null,
        checkRunId: checked?.id ?? null,
        createdBy: actor.id,
      },
    });
  });

  const urgent = isUrgent(task, now);
  for (const userId of approverIds) {
    await notify(deps, {
      userId,
      kind: "APPROVAL_REQUESTED",
      title: t.notifications.approvalRequested(actor.name, task.title),
      link: `/aufgaben/${task.id}`,
      push: urgent,
      pushBody: pushBody(task.client.name, task.title, task.dueAt),
    });
  }
  return approval;
}

/** Anfrage zurückziehen: der Owner holt den Text zurück in die Bearbeitung. */
export async function withdrawApproval(deps: Deps, actor: NamedActor, taskId: string) {
  const { task, document, openApproval } = await loadDocument(deps.db, taskId);
  assert(canRequestApproval(actor, task));
  if (task.status !== "FREIGABE_ANGEFRAGT" || !openApproval) throw new DomainError(t.approvals.errors.noOpenRequest);
  await deps.db.$transaction(async (tx) => {
    await tx.approval.update({ where: { id: openApproval.id }, data: { decision: "ZURUECKGEZOGEN", decidedBy: actor.id, decidedAt: deps.now() } });
    await tx.document.update({ where: { id: document.id }, data: { lockedBy: null, lockedAt: null } });
    await changeDocumentStatus(tx, { taskId, documentId: document.id, content: document.content as Prisma.InputJsonValue, status: "IN_BEARBEITUNG", actorId: actor.id });
  });
}

/**
 * Prüfung übernehmen (BRIEFING 6.4 Schritt 3): wer den Text öffnet, übernimmt; andere sehen
 * "… prüft gerade" und übernehmen nur nach Bestätigung (force). Der Prüfer bekommt die Sperre.
 */
export async function claimApproval(deps: Deps, actor: NamedActor, taskId: string, force = false): Promise<{ claimed: boolean; claimedBy: string | null }> {
  const { task, document, openApproval } = await loadDocument(deps.db, taskId);
  if (task.status !== "FREIGABE_ANGEFRAGT" || !openApproval) return { claimed: false, claimedBy: null };
  const ctx = await loadPermissionContext(deps.db, actor.id);
  const { allowed } = canApproveText(actor, ctx, task);
  if (!allowed) return { claimed: false, claimedBy: openApproval.claimedBy };
  if (openApproval.claimedBy === actor.id) return { claimed: true, claimedBy: actor.id };
  if (openApproval.claimedBy && !force) return { claimed: false, claimedBy: openApproval.claimedBy };
  const now = deps.now();
  await deps.db.$transaction([
    deps.db.approval.update({ where: { id: openApproval.id }, data: { claimedBy: actor.id, claimedAt: now } }),
    deps.db.document.update({ where: { id: document.id }, data: { lockedBy: actor.id, lockedAt: now, lockRequestedBy: null } }),
  ]);
  return { claimed: true, claimedBy: actor.id };
}

/**
 * Entscheidung (BRIEFING 6.4 Schritte 5 und 6): Freigeben speichert eine Version, für genau die
 * die Freigabe gilt; Änderungen anfordern braucht einen Kommentar. Den eigenen Text gibt nur frei,
 * wer das Zusatzrecht Selbstfreigabe hat; das wird markiert und protokolliert.
 */
export async function decideApproval(
  deps: Deps,
  actor: NamedActor,
  taskId: string,
  input: { decision: "FREIGEGEBEN" | "AENDERUNGEN"; note?: string | null },
) {
  const { task, document, openApproval } = await loadDocument(deps.db, taskId);
  if (task.status !== "FREIGABE_ANGEFRAGT" || !openApproval) throw new DomainError(t.approvals.errors.noOpenRequest);
  const ctx = await loadPermissionContext(deps.db, actor.id);
  const { allowed, isSelfApproval } = canApproveText(actor, ctx, task);
  assert(allowed);
  if (openApproval.claimedBy && openApproval.claimedBy !== actor.id) throw new DomainError(t.approvals.errors.claimedByOther);
  const note = input.note?.trim() || null;
  if (input.decision === "AENDERUNGEN" && !note) throw new DomainError(t.approvals.errors.noteRequired);

  const now = deps.now();
  const status = input.decision === "FREIGEGEBEN" ? "FREIGEGEBEN" : "AENDERUNGEN_ANGEFORDERT";
  await deps.db.$transaction(async (tx) => {
    const version = await changeDocumentStatus(tx, {
      taskId, documentId: document.id, content: document.content as Prisma.InputJsonValue, status, actorId: actor.id,
    });
    await tx.approval.update({
      where: { id: openApproval.id },
      data: {
        decision: input.decision,
        decidedBy: actor.id,
        decidedAt: now,
        claimedBy: openApproval.claimedBy ?? actor.id,
        claimedAt: openApproval.claimedAt ?? now,
        note: note ?? openApproval.note,
        isSelfApproval: input.decision === "FREIGEGEBEN" && isSelfApproval,
        // die Freigabe gilt für genau diese Version (BRIEFING 6.3)
        versionId: input.decision === "FREIGEGEBEN" ? version.id : openApproval.versionId,
      },
    });
    await tx.document.update({ where: { id: document.id }, data: { lockedBy: null, lockedAt: null, lockRequestedBy: null } });
    await writeAudit(tx, {
      actorId: actor.id,
      action: input.decision === "AENDERUNGEN" ? AuditAction.CHANGES_REQUESTED : isSelfApproval ? AuditAction.SELF_APPROVAL : AuditAction.APPROVAL_GRANTED,
      entity: "Document",
      entityId: document.id,
      after: { taskId, version: version.number },
    });
  });

  if (task.ownerId !== actor.id) {
    await notify(deps, {
      userId: task.ownerId,
      kind: "APPROVAL_DECIDED",
      title: input.decision === "FREIGEGEBEN" ? t.notifications.approved(actor.name, task.title) : t.notifications.changesRequested(actor.name, task.title),
      link: `/aufgaben/${task.id}`,
      push: isUrgent(task, now),
      pushBody: pushBody(task.client.name, task.title, task.dueAt),
    });
  }
}

/**
 * Freigegebenen Text ändern (BRIEFING 6.3): setzt ihn zurück auf In Bearbeitung,
 * die alte Freigabe gilt nur für ihre Version.
 */
export async function reopenForEditing(deps: Deps, actor: NamedActor, taskId: string) {
  const { task, document } = await loadDocument(deps.db, taskId);
  const ctx = await loadPermissionContext(deps.db, actor.id);
  assert(canEditTask(actor, ctx, task));
  if (!["FREIGEGEBEN", "BEIM_KUNDEN"].includes(task.status)) throw new DomainError(t.approvals.errors.notReopenable);
  await changeDocumentStatus(deps.db, { taskId, documentId: document.id, content: document.content as Prisma.InputJsonValue, status: "IN_BEARBEITUNG", actorId: actor.id });
}

/** Die zuletzt erteilte Freigabe mit ihrer Version (Grundlage für Versand und Export). */
export async function latestApproval(deps: Pick<Deps, "db">, documentId: string) {
  return deps.db.approval.findFirst({
    where: { documentId, decision: "FREIGEGEBEN" },
    orderBy: { decidedAt: "desc" },
    include: { version: true },
  });
}

export { hasApprovalRight };
