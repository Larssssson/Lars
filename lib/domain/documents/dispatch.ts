import { z } from "zod";
import { t } from "@/i18n";
import { latestApproval } from "@/lib/domain/approvals/service";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { assert, canEditTask, type NamedActor } from "@/lib/domain/permissions";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import { blockTexts, type JSONNode } from "@/lib/editor/content";
import type { Prisma, TemplateChoice } from "@/lib/generated/prisma/client";
import { exportTemplate } from "./export-template";
import { finalFileName, targetFolder } from "./filing";
import { buildHtml } from "./html-export";
import { renderPdf } from "./pdf";
import { changeDocumentStatus, loadDocument, type LoadedDocument } from "./service";
import { buildDocx } from "./word-export";

export const dispatchSchema = z.object({
  target: z.enum(["KUNDE_ABSTIMMUNG", "KUNDE_FINAL", "MEDIEN", "INTERN"]),
  recipients: z.string().trim().min(1, t.dispatch.errors.recipientsRequired).max(2000),
  channel: z.string().trim().min(1, t.dispatch.errors.channelRequired).max(200),
  template: z.enum(["RP", "KUNDE"]).default("RP"),
});

/** Inhalt für Export und Versand: nach der Freigabe immer genau die freigegebene Version (BRIEFING 6.3). */
async function exportSource(deps: Deps, loaded: LoadedDocument, versionId?: string | null) {
  const { task, document } = loaded;
  if (versionId) {
    const version = await deps.db.documentVersion.findFirst({ where: { id: versionId, documentId: document.id } });
    if (!version) throw new NotFoundError(t.errors.notFound);
    return { content: version.content as JSONNode, number: version.number, versionId: version.id };
  }
  if (["FREIGEGEBEN", "BEIM_KUNDEN", "ERLEDIGT", "ARCHIVIERT"].includes(task.status)) {
    const approval = await latestApproval(deps, document.id);
    if (approval) return { content: approval.version.content as JSONNode, number: approval.version.number, versionId: approval.versionId };
  }
  const current = document.currentVersionId ? await deps.db.documentVersion.findUnique({ where: { id: document.currentVersionId } }) : null;
  return { content: document.content as JSONNode, number: current?.number ?? 0, versionId: current?.id ?? null };
}

/**
 * Export als Word oder PDF, saubere Fassung ohne Kommentare und Änderungsmarkierungen,
 * mit RP- oder Kundenvorlage (BRIEFING 7.3). Lesen dürfen alle Nutzer (BRIEFING 3.2).
 */
export async function exportDocument(
  deps: Deps,
  actor: NamedActor,
  taskId: string,
  input: { kind: "docx" | "pdf"; template: TemplateChoice; versionId?: string | null },
) {
  assert(actor.active);
  const loaded = await loadDocument(deps.db, taskId);
  const { task, document } = loaded;
  const source = await exportSource(deps, loaded, input.versionId);
  const template = await exportTemplate(deps, input.template, task.client);
  const base = { content: source.content, format: document.format, title: document.title, template };
  const fileName = finalFileName({
    date: deps.now(),
    shortName: task.client.shortName,
    formatName: document.documentFormat.name,
    title: document.title,
    version: source.number,
  });
  if (input.kind === "docx") {
    return { data: await buildDocx(base), fileName, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }
  return { data: await renderPdf(buildHtml(base)), fileName: fileName.replace(/\.docx$/, ".pdf"), mimeType: "application/pdf" };
}

/** Klartext der freigegebenen Fassung für "Text kopieren" und den Mail-Entwurf (BRIEFING 6.5). */
export async function dispatchText(deps: Deps, taskId: string): Promise<string> {
  const loaded = await loadDocument(deps.db, taskId);
  const source = await exportSource(deps, loaded);
  return blockTexts(source.content)
    .filter((b) => b.text)
    .map((b) => b.text)
    .join("\n\n");
}

/**
 * Versand festhalten (BRIEFING 6.5): impress verschickt nichts selbst. Ziel Kunde zur Abstimmung
 * führt zu "Beim Kunden"; Medien, Kunde final und intern zu "Erledigt" mit Ablage der finalen
 * Word-Datei im SharePoint (BRIEFING 9, DECISIONS D-006).
 */
export async function recordDispatch(deps: Deps, actor: NamedActor, taskId: string, raw: z.input<typeof dispatchSchema>) {
  const input = dispatchSchema.parse(raw);
  const loaded = await loadDocument(deps.db, taskId);
  const { task, document } = loaded;
  const ctx = await loadPermissionContext(deps.db, actor.id);
  assert(canEditTask(actor, ctx, task));
  if (task.status !== "FREIGEGEBEN") throw new DomainError(t.dispatch.errors.notApproved);
  const approval = await latestApproval(deps, document.id);
  if (!approval) throw new DomainError(t.dispatch.errors.notApproved);

  const now = deps.now();
  let sharePointFileUrl: string | null = null;
  if (input.target !== "KUNDE_ABSTIMMUNG") {
    const template = await exportTemplate(deps, input.template, task.client);
    const data = await buildDocx({ content: approval.version.content as JSONNode, format: document.format, title: document.title, template });
    const folder = targetFolder({ shortName: task.client.shortName, formatFolder: document.documentFormat.sharePointFolder, project: task.project, date: now });
    const name = finalFileName({ date: now, shortName: task.client.shortName, formatName: document.documentFormat.name, title: document.title, version: approval.version.number });
    sharePointFileUrl = (await deps.documents.putFile(folder, name, data, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).url;
  }

  await deps.db.$transaction(async (tx) => {
    await tx.document.update({ where: { id: document.id }, data: { templateChoice: input.template } });
    await tx.dispatch.create({
      data: {
        documentId: document.id,
        versionId: approval.versionId,
        target: input.target,
        recipients: input.recipients,
        channel: input.channel,
        sentAt: now,
        sentBy: actor.id,
        sharePointFileUrl,
        createdBy: actor.id,
      },
    });
    const done = input.target !== "KUNDE_ABSTIMMUNG";
    await changeDocumentStatus(tx, {
      taskId,
      documentId: document.id,
      content: approval.version.content as Prisma.InputJsonValue,
      status: done ? "ERLEDIGT" : "BEIM_KUNDEN",
      actorId: actor.id,
      completedAt: done ? now : undefined,
    });
  });
  return { sharePointFileUrl };
}

/** Kunde ist einverstanden: die Freigabe bleibt gültig, der Text geht zurück auf Freigegeben (BRIEFING 6.5). */
export async function clientAgreed(deps: Deps, actor: NamedActor, taskId: string) {
  const { task, document } = await loadDocument(deps.db, taskId);
  const ctx = await loadPermissionContext(deps.db, actor.id);
  assert(canEditTask(actor, ctx, task));
  if (task.status !== "BEIM_KUNDEN") throw new DomainError(t.dispatch.errors.notAtClient);
  const approval = await latestApproval(deps, document.id);
  await changeDocumentStatus(deps.db, {
    taskId,
    documentId: document.id,
    content: (approval?.version.content ?? document.content) as Prisma.InputJsonValue,
    status: "FREIGEGEBEN",
    actorId: actor.id,
  });
}
