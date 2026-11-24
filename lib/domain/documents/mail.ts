import { t } from "@/i18n";
import type { Deps } from "@/lib/domain/deps";
import type { NamedActor } from "@/lib/domain/permissions";
import type { TemplateChoice } from "@/lib/generated/prisma/client";
import { exportDocument } from "./dispatch";

export type MailTone = "freundlich" | "nuechtern";
export type MailLength = "kurz" | "lang";

/**
 * Vorformulierte Mail mit Anhang als .eml-Entwurf (DECISIONS D-129). Outlook öffnet die Datei dank
 * „X-Unsent: 1“ als neue, bearbeitbare Mail; Empfänger trägt die Person selbst ein. impress verschickt nichts (Grundsatz 4).
 */
export async function buildMailDraft(
  deps: Deps,
  actor: NamedActor,
  taskId: string,
  input: { kind: "docx" | "pdf"; template: TemplateChoice; versionId?: string | null; tone: MailTone; length: MailLength },
) {
  const file = await exportDocument(deps, actor, taskId, input);
  const task = await deps.db.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { title: true, client: { select: { name: true } }, document: { select: { title: true, documentFormat: { select: { name: true } } } } },
  });
  const sender = actor.name.trim().split(/\s+/)[0] ?? actor.name;
  const vars = { title: task.document?.title ?? task.title, format: task.document?.documentFormat.name ?? "", client: task.client.name, sender };
  const body = t.documents.mail.bodies[input.tone][input.length](vars);
  const subject = t.documents.mail.subject(vars);
  return { eml: buildEml({ subject, body, attachment: { name: file.fileName, mimeType: file.mimeType, data: file.data } }), fileName: `${file.fileName.replace(/\.(docx|pdf)$/, "")}.eml` };
}

/** Kodierter Kopf nach RFC 2047, damit Umlaute im Betreff ankommen. */
function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function wrap(base64: string): string {
  return base64.replace(/.{1,76}/g, "$&\r\n");
}

export function buildEml(mail: { subject: string; body: string; attachment: { name: string; mimeType: string; data: Uint8Array } }): string {
  const boundary = `impress-${crypto.randomUUID()}`;
  const fileName = encodeHeader(mail.attachment.name).replace(/"/g, "");
  return [
    "MIME-Version: 1.0",
    "X-Unsent: 1",
    "To: ",
    `Subject: ${encodeHeader(mail.subject)}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(Buffer.from(mail.body.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64")),
    `--${boundary}`,
    `Content-Type: ${mail.attachment.mimeType}; name="${fileName}"`,
    `Content-Disposition: attachment; filename="${fileName}"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrap(Buffer.from(mail.attachment.data).toString("base64")),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}
