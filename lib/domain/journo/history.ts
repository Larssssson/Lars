import { z } from "zod";
import { t } from "@/i18n";
import { redactContactData } from "@/lib/ai/sanitize";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { assert, isCvd, type Actor } from "@/lib/domain/permissions";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Kontakthistorie (DECISIONS D-134): wer hatte wann Kontakt zu einer Journalistin oder einem Journalisten,
 * wozu und für welchen Kunden. Von Hand eingetragen oder automatisch beim Versand an Medien.
 * Keine Kontaktdaten und keine Textinhalte (Grundsatz 9).
 */
import { MANUAL_KINDS } from "./kinds";
export { MANUAL_KINDS };

export const contactEventSchema = z.object({
  kind: z.enum(MANUAL_KINDS),
  at: z.date(t.journo.contactHistory.errors.date),
  clientId: z.uuid().nullish(),
  note: z.string().trim().max(300, t.journo.contactHistory.errors.noteTooLong).nullish().transform((v) => v || null),
});

export async function addContactEvent(deps: Deps, actor: Actor, journalistId: string, raw: z.input<typeof contactEventSchema>) {
  assert(actor.active);
  const input = contactEventSchema.parse(raw);
  if (input.at.getTime() > deps.now().getTime() + 86_400_000) throw new DomainError(t.journo.contactHistory.errors.future);
  // Telefonnummern und Mailadressen gehören in die Kontaktdaten, nicht in die Notiz
  if (input.note && redactContactData(input.note) !== input.note) throw new DomainError(t.journo.contactHistory.errors.contactData);
  const journalist = z.uuid().safeParse(journalistId).success ? await deps.db.journalist.findUnique({ where: { id: journalistId } }) : null;
  if (!journalist) throw new NotFoundError(t.errors.notFound);
  const event = await deps.db.contactEvent.create({
    data: { journalistId, userId: actor.id, clientId: input.clientId ?? null, kind: input.kind, at: input.at, note: input.note, createdBy: actor.id, updatedBy: actor.id },
  });
  await deps.db.journalist.update({ where: { id: journalistId }, data: { lastActivityAt: deps.now(), firstContactAt: journalist.firstContactAt ?? input.at } });
  return event;
}

/** Eigene Einträge löschen; CVDs dürfen jeden Eintrag löschen. Automatische Versand-Einträge nur CVDs. */
export async function deleteContactEvent(deps: Deps, actor: Actor, eventId: string) {
  const event = z.uuid().safeParse(eventId).success ? await deps.db.contactEvent.findUnique({ where: { id: eventId } }) : null;
  if (!event) throw new NotFoundError(t.errors.notFound);
  assert(actor.active && (isCvd(actor) || (event.userId === actor.id && !event.automatic)));
  await deps.db.contactEvent.delete({ where: { id: eventId } });
}

/**
 * Versand an Medien: vorgemerkte Kontakte, deren Name im Empfängerfeld steht, bekommen einen Eintrag „Versand“.
 * Läuft in der Transaktion des Versands.
 */
export async function recordDispatchContacts(tx: Db, input: { documentId: string; taskId: string; clientId: string; recipients: string; actorId: string; at: Date }) {
  const bookmarks = await tx.contactBookmark.findMany({ where: { documentId: input.documentId }, include: { journalist: { select: { id: true, firstName: true, lastName: true, firstContactAt: true } } } });
  const recipients = input.recipients.toLowerCase();
  const reached = bookmarks.map((b) => b.journalist).filter((j) => recipients.includes(`${j.firstName} ${j.lastName}`.toLowerCase()));
  for (const j of reached) {
    await tx.contactEvent.create({
      data: { journalistId: j.id, userId: input.actorId, clientId: input.clientId, taskId: input.taskId, kind: "VERSAND", at: input.at, automatic: true, createdBy: input.actorId, updatedBy: input.actorId },
    });
    await tx.journalist.update({ where: { id: j.id }, data: { lastActivityAt: input.at, firstContactAt: j.firstContactAt ?? input.at } });
  }
  return reached.length;
}

export function listContactEvents(db: Db, journalistId: string) {
  return db.contactEvent.findMany({
    where: { journalistId },
    include: { user: { select: { name: true } }, client: { select: { name: true } }, task: { select: { id: true, title: true } } },
    orderBy: { at: "desc" },
    take: 100,
  });
}
