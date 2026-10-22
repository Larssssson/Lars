import { z } from "zod";
import { t } from "@/i18n";
import { AuditAction, writeAudit } from "@/lib/domain/audit";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { notify } from "@/lib/domain/notifications";
import { assert, canEditContact, isCvd, type Actor, type NamedActor } from "@/lib/domain/permissions";
import { createTask } from "@/lib/domain/tasks/service";
import { addWorkdays, atTime, dateKey } from "@/lib/time";
import { activeOwnerIds, canReveal, contactName, requireContact } from "./contacts";

const uuid = z.uuid();
const HOUR = 3_600_000;

export const requestSchema = z.object({
  journalistId: z.uuid(),
  clientId: z.uuid(),
  projectId: z.uuid().nullish().transform((v) => v || null),
  taskId: z.uuid().nullish().transform((v) => v || null),
  reason: z.string().trim().min(1, t.journo.errors.reasonRequired).max(1000),
  urgency: z.enum(["NORMAL", "DRINGEND"]).default("NORMAL"),
});

/** Empfänger einer Anfrage: alle aktiven Owner; ohne Owner entscheiden die CVDs (DECISIONS D-090). */
async function deciders(deps: Deps, journalistId: string, exceptUserId: string): Promise<string[]> {
  const owners = (await activeOwnerIds(deps.db, journalistId)).filter((id) => id !== exceptUserId);
  if (owners.length) {
    const active = await deps.db.user.findMany({ where: { id: { in: owners }, active: true }, select: { id: true } });
    if (active.length) return active.map((u) => u.id);
  }
  return (await deps.db.user.findMany({ where: { role: "CVD", active: true, id: { not: exceptUserId } }, select: { id: true } })).map((u) => u.id);
}

async function requestTexts(deps: Deps, request: { journalistId: string; clientId: string; urgency: "NORMAL" | "DRINGEND" }) {
  const [contact, client] = await Promise.all([
    deps.db.journalist.findUniqueOrThrow({ where: { id: request.journalistId }, include: { media: { select: { name: true } } } }),
    deps.db.client.findUniqueOrThrow({ where: { id: request.clientId }, select: { name: true } }),
  ]);
  const media = contact.media?.name ?? t.journo.noMedia;
  return {
    title: t.journo.notifications.request(client.name, media),
    reminder: t.journo.notifications.reminder(client.name, media),
    // ohne Namen des Kontakts, Push-Texte nennen Kunde und Dringlichkeit (BRIEFING 7.9)
    push: t.journo.notifications.requestPush(client.name, t.journo.request.urgencies[request.urgency] ?? ""),
  };
}

/** Kontakt anfragen (BRIEFING 6.7 Schritte 1 und 2): Owner bekommen Push und Glocke. */
export async function createContactRequest(deps: Deps, actor: NamedActor, raw: z.input<typeof requestSchema>) {
  assert(canEditContact(actor));
  const input = requestSchema.parse(raw);
  await requireContact(deps.db, input.journalistId);
  const client = await deps.db.client.findUnique({ where: { id: input.clientId } });
  if (!client) throw new NotFoundError(t.errors.notFound);
  const now = deps.now();
  if (await canReveal(deps.db, actor, input.journalistId, { clientId: input.clientId, projectId: input.projectId }, now)) {
    throw new DomainError(t.journo.request.notNeeded);
  }
  const open = await deps.db.contactRequest.count({ where: { journalistId: input.journalistId, requesterId: actor.id, clientId: input.clientId, status: "OFFEN" } });
  if (open) throw new DomainError(t.journo.request.alreadyOpen);

  const request = await deps.db.contactRequest.create({ data: { ...input, requesterId: actor.id, createdAt: now, createdBy: actor.id, updatedBy: actor.id } });
  await deps.db.journalist.update({ where: { id: input.journalistId }, data: { lastActivityAt: now } });
  const texts = await requestTexts(deps, request);
  for (const userId of await deciders(deps, input.journalistId, actor.id)) {
    await notify(deps, { userId, kind: "CONTACT_REQUEST", title: texts.title, link: `/journo-hub/anfragen`, push: true, pushBody: texts.push });
  }
  return request;
}

/** Wer darf entscheiden: aktive Owner, bei Kontakten ohne Owner und immer auch ein CVD. */
async function mayDecide(deps: Deps, actor: Actor, journalistId: string): Promise<boolean> {
  return isCvd(actor) || (await activeOwnerIds(deps.db, journalistId)).includes(actor.id);
}

export type RequestDecision = "FREIGEBEN" | "UEBERNEHMEN" | "ABLEHNEN";

/**
 * Entscheidung eines Owners (BRIEFING 6.7 Schritt 3): Freigeben (Nummer und Mail für Kunde bzw.
 * Projekt), Selbst übernehmen (Aufgabe für den Owner) oder Ablehnen mit Begründung.
 */
export async function decideContactRequest(deps: Deps, actor: NamedActor, requestId: string, decision: RequestDecision, note?: string | null) {
  if (!uuid.safeParse(requestId).success) throw new NotFoundError(t.errors.notFound);
  const request = await deps.db.contactRequest.findUnique({ where: { id: requestId }, include: { journalist: true, client: true } });
  if (!request) throw new NotFoundError(t.errors.notFound);
  assert(await mayDecide(deps, actor, request.journalistId));
  if (request.status !== "OFFEN") throw new DomainError(t.journo.errors.requestClosed);
  const text = note?.trim() || null;
  if (decision === "ABLEHNEN" && !text) throw new DomainError(t.journo.errors.reasonRequired);
  const now = deps.now();

  if (decision === "UEBERNEHMEN") {
    const requester = await deps.db.user.findUnique({ where: { id: request.requesterId }, select: { name: true } });
    const due = request.urgency === "DRINGEND" ? new Date(now.getTime() + 2 * HOUR) : atTime(addWorkdays(dateKey(now), 1), "12:00");
    await createTask(deps, actor, {
      clientId: request.clientId,
      projectId: request.projectId,
      category: "MEDIENARBEIT",
      type: "AUFGABE",
      title: t.journo.request.taskTitle(contactName(request.journalist)),
      description: t.journo.request.taskDescription(requester?.name ?? "", request.reason),
      ownerId: actor.id,
      dueAt: due,
    });
  }
  await deps.db.$transaction(async (tx) => {
    await tx.contactRequest.update({
      where: { id: request.id },
      data: {
        status: decision === "FREIGEBEN" ? "FREIGEGEBEN" : decision === "UEBERNEHMEN" ? "UEBERNOMMEN" : "ABGELEHNT",
        decidedBy: actor.id,
        decidedAt: now,
        decisionNote: text,
        updatedBy: actor.id,
      },
    });
    if (decision === "FREIGEBEN") {
      await tx.contactAccessGrant.create({
        data: { journalistId: request.journalistId, userId: request.requesterId, clientId: request.clientId, projectId: request.projectId, grantedBy: actor.id, createdBy: actor.id, updatedBy: actor.id },
      });
    }
    await tx.journalist.update({ where: { id: request.journalistId }, data: { lastActivityAt: now } });
  });
  if (decision === "FREIGEBEN") {
    await writeAudit(deps.db, {
      actorId: actor.id,
      action: AuditAction.CONTACT_ACCESS_GRANTED,
      entity: "Journalist",
      entityId: request.journalistId,
      after: { userId: request.requesterId, clientId: request.clientId, projectId: request.projectId },
    });
  }
  const status = t.journo.request.statuses[decision === "FREIGEBEN" ? "FREIGEGEBEN" : decision === "UEBERNEHMEN" ? "UEBERNOMMEN" : "ABGELEHNT"] ?? "";
  await notify(deps, {
    userId: request.requesterId,
    kind: "CONTACT_REQUEST_ANSWERED",
    title: t.journo.notifications.answered(status, actor.name),
    link: `/journo-hub/${request.journalistId}`,
    push: false,
  });
}

/** Erinnerung nach 24 Stunden ohne Antwort, einmal (BRIEFING 6.7 Schritt 4). Job stündlich. */
export async function remindOpenRequests(deps: Deps): Promise<number> {
  const now = deps.now();
  const due = await deps.db.contactRequest.findMany({ where: { status: "OFFEN", remindedAt: null, createdAt: { lte: new Date(now.getTime() - 24 * HOUR) } } });
  for (const request of due) {
    const texts = await requestTexts(deps, request);
    for (const userId of await deciders(deps, request.journalistId, request.requesterId)) {
      await notify(deps, { userId, kind: "CONTACT_REQUEST", title: texts.reminder, link: `/journo-hub/anfragen`, push: true, pushBody: texts.push });
    }
    await deps.db.contactRequest.update({ where: { id: request.id }, data: { remindedAt: now } });
  }
  return due.length;
}

/** Anfragen an mich, meine Anfragen und für CVDs alle (BRIEFING 6.7 Schritt 5: ohne Benachrichtigung). */
export async function listContactRequests(deps: Pick<Deps, "db">, actor: Actor) {
  const include = {
    journalist: { select: { id: true, firstName: true, lastName: true, media: { select: { name: true } } } },
    client: { select: { name: true } },
    project: { select: { title: true } },
    task: { select: { title: true } },
  } as const;
  const owned = await deps.db.contactOwner.findMany({ where: { userId: actor.id, active: true, pendingApproval: false }, select: { journalistId: true } });
  const ownerless = await deps.db.journalist.findMany({ where: { owners: { none: { active: true, pendingApproval: false } } }, select: { id: true } });
  const decidable = [...owned.map((o) => o.journalistId), ...(isCvd(actor) ? ownerless.map((j) => j.id) : [])];
  const [toMe, mine, all] = await Promise.all([
    deps.db.contactRequest.findMany({ where: { journalistId: { in: decidable }, requesterId: { not: actor.id } }, include, orderBy: { createdAt: "desc" } }),
    deps.db.contactRequest.findMany({ where: { requesterId: actor.id }, include, orderBy: { createdAt: "desc" } }),
    isCvd(actor) ? deps.db.contactRequest.findMany({ include, orderBy: { createdAt: "desc" }, take: 200 }) : Promise.resolve([]),
  ]);
  const ids = [...new Set([...toMe, ...mine, ...all].flatMap((r) => [r.requesterId, r.decidedBy]).filter((x): x is string => Boolean(x)))];
  const users = await deps.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return { toMe, mine, all, names: new Map(users.map((u) => [u.id, u.name])) };
}
