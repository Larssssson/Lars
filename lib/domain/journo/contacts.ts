import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";
import { t } from "@/i18n";
import { AuditAction, writeAudit } from "@/lib/domain/audit";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { notify } from "@/lib/domain/notifications";
import {
  assert,
  canEditContact,
  canRevealContactDetails,
  canRevokeVerificationOrDeleteContact,
  isCvd,
  type Actor,
  type NamedActor,
} from "@/lib/domain/permissions";
import type { ContactKind, Prisma, PrismaClient } from "@/lib/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;
const uuid = z.uuid();

/** Höchstens 3 aktive Owner; ein vierter braucht die Zustimmung eines CVD (BRIEFING 6.7). */
export const MAX_ACTIVE_OWNERS = 3;

// ------------------------------------------------------------- Normalisieren und Verdecken

/** Telefonnummer nach E.164, deutsche Nummern ohne Vorwahl-Präfix werden als DE gelesen. */
export function normalizePhone(raw: string): string | null {
  const parsed = parsePhoneNumberFromString(raw.trim(), "DE");
  return parsed?.isValid() ? parsed.number : null;
}

export function normalizeMail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Telefon zeigt nur die letzten 2 Ziffern (BRIEFING 7.5). */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return `•••• ••• ••${digits.slice(-2)}`;
}

export function maskDetail(kind: ContactKind, value: string): string {
  return kind === "TELEFON" ? maskPhone(value) : t.journo.mailHidden;
}

export const contactName = (j: { firstName: string; lastName: string }) => `${j.firstName} ${j.lastName}`.trim();

// ------------------------------------------------------------- Anlegen und Bearbeiten

const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, t.journo.errors.nameRequired).max(80),
  lastName: z.string().trim().min(1, t.journo.errors.nameRequired).max(80),
  mediaId: z.uuid().nullish().transform((v) => v || null),
  desk: optionalText(80),
  function: optionalText(120),
  topics: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  region: optionalText(80),
  notes: optionalText(4000),
  firstContactAt: z.date().nullish().transform((v) => v ?? null),
});
export type ContactInput = z.input<typeof contactSchema>;

export const detailsSchema = z.object({
  phone: z.string().trim().max(40).nullish(),
  mail: z.string().trim().max(200).nullish(),
  linkedin: z.string().trim().max(300).nullish(),
  x: z.string().trim().max(100).nullish(),
});
export type DetailsInput = z.input<typeof detailsSchema>;

const DETAIL_KINDS: [keyof DetailsInput, ContactKind][] = [["phone", "TELEFON"], ["mail", "MAIL"], ["linkedin", "LINKEDIN"], ["x", "X"]];

function normalizeDetail(kind: ContactKind, value: string): string {
  if (kind === "TELEFON") {
    const phone = normalizePhone(value);
    if (!phone) throw new DomainError(t.journo.errors.phoneInvalid);
    return phone;
  }
  if (kind === "MAIL") {
    const mail = normalizeMail(value);
    if (!z.email().safeParse(mail).success) throw new DomainError(t.journo.errors.mailInvalid);
    return mail;
  }
  return value.trim();
}

/**
 * Kontaktdaten setzen: leere Angaben darf jeder ergänzen, vorhandene nur ändern, wer sie sehen darf
 * (DECISIONS D-087). Ein leerer Wert löscht die Angabe.
 */
async function writeDetails(db: Db, journalistId: string, raw: DetailsInput, actorId: string, mayReveal: boolean) {
  const input = detailsSchema.parse(raw);
  for (const [field, kind] of DETAIL_KINDS) {
    const value = input[field];
    if (value === undefined || value === null) continue;
    const existing = await db.contactDetail.findFirst({ where: { journalistId, kind, isPrimary: true } });
    if (existing && !mayReveal) throw new DomainError(t.journo.errors.detailLocked);
    if (!value) {
      if (existing) await db.contactDetail.delete({ where: { id: existing.id } });
      continue;
    }
    const normalized = normalizeDetail(kind, value);
    if (existing) await db.contactDetail.update({ where: { id: existing.id }, data: { value: normalized, updatedBy: actorId } });
    else await db.contactDetail.create({ data: { journalistId, kind, value: normalized, isPrimary: true, createdBy: actorId, updatedBy: actorId } });
  }
}

/** Kontakt von Hand anlegen: Label Manuell, wer anlegt, wird Owner (DECISIONS D-086). */
export async function createContact(deps: Deps, actor: Actor, raw: ContactInput, details: DetailsInput = {}) {
  assert(canEditContact(actor));
  const input = contactSchema.parse(raw);
  const now = deps.now();
  return deps.db.$transaction(async (tx) => {
    const contact = await tx.journalist.create({
      data: { ...input, status: "MANUELL", source: "MENSCH", lastActivityAt: now, createdBy: actor.id, updatedBy: actor.id },
    });
    await writeDetails(tx, contact.id, details, actor.id, true);
    await tx.contactOwner.create({ data: { journalistId: contact.id, userId: actor.id, since: now, createdBy: actor.id, updatedBy: actor.id } });
    return contact;
  });
}

export async function requireContact(db: Db, journalistId: string) {
  if (!uuid.safeParse(journalistId).success) throw new NotFoundError(t.errors.notFound);
  const contact = await db.journalist.findUnique({ where: { id: journalistId } });
  if (!contact) throw new NotFoundError(t.errors.notFound);
  return contact;
}

export async function updateContact(deps: Deps, actor: Actor, journalistId: string, raw: ContactInput, details: DetailsInput = {}, context: RevealContext = {}) {
  assert(canEditContact(actor));
  await requireContact(deps.db, journalistId);
  const input = contactSchema.parse(raw);
  const mayReveal = await canReveal(deps.db, actor, journalistId, context, deps.now());
  return deps.db.$transaction(async (tx) => {
    const updated = await tx.journalist.update({ where: { id: journalistId }, data: { ...input, lastActivityAt: deps.now(), updatedBy: actor.id } });
    await writeDetails(tx, journalistId, details, actor.id, mayReveal);
    return updated;
  });
}

// ------------------------------------------------------------- Aufdecken (BRIEFING 7.5, 11, DECISIONS D-012)

/** Kontext einer Freigabe: Kunde in der Kopfzeile bzw. Aufgabe; Projektfreigaben gelten nur im Projekt. */
export type RevealContext = { clientId?: string | null; projectId?: string | null };

export async function activeOwnerIds(db: Db, journalistId: string): Promise<string[]> {
  const owners = await db.contactOwner.findMany({ where: { journalistId, active: true, pendingApproval: false } });
  return owners.map((o) => o.userId);
}

export async function hasAccessGrant(db: Db, userId: string, journalistId: string, context: RevealContext, now: Date): Promise<boolean> {
  if (!context.clientId) return false;
  const grants = await db.contactAccessGrant.findMany({ where: { journalistId, userId, clientId: context.clientId } });
  return grants.some((g) => (!g.validUntil || g.validUntil > now) && (!g.projectId || g.projectId === context.projectId));
}

export async function canReveal(db: Db, actor: Actor, journalistId: string, context: RevealContext, now: Date): Promise<boolean> {
  const [owners, grant] = await Promise.all([activeOwnerIds(db, journalistId), hasAccessGrant(db, actor.id, journalistId, context, now)]);
  return canRevealContactDetails(actor, { isActiveOwner: owners.includes(actor.id), hasAccessGrantForContext: grant });
}

/** Eine Angabe aufdecken; jedes Aufdecken wird protokolliert, auch beim CVD. */
export async function revealDetail(deps: Deps, actor: Actor, detailId: string, context: RevealContext): Promise<string> {
  if (!uuid.safeParse(detailId).success) throw new NotFoundError(t.errors.notFound);
  const detail = await deps.db.contactDetail.findUnique({ where: { id: detailId } });
  if (!detail) throw new NotFoundError(t.errors.notFound);
  const now = deps.now();
  assert(await canReveal(deps.db, actor, detail.journalistId, context, now));
  await deps.db.revealLog.create({ data: { journalistId: detail.journalistId, userId: actor.id, kind: detail.kind, at: now, createdBy: actor.id } });
  await writeAudit(deps.db, { actorId: actor.id, action: AuditAction.CONTACT_REVEALED, entity: "Journalist", entityId: detail.journalistId, after: { kind: detail.kind } });
  return detail.value;
}

// ------------------------------------------------------------- Verifizieren (BRIEFING 7.5)

export async function missingForVerification(db: Db, journalistId: string): Promise<string[]> {
  const contact = await requireContact(db, journalistId);
  const kinds = new Set((await db.contactDetail.findMany({ where: { journalistId } })).map((d) => d.kind));
  const f = t.journo.fields;
  const missing: string[] = [];
  if (!kinds.has("TELEFON")) missing.push(f.phone);
  if (!kinds.has("MAIL")) missing.push(f.mail);
  if (!contact.firstContactAt) missing.push(f.firstContactAt);
  return missing;
}

/** Verifizieren mit Telefon, Mail und Datum des ersten Kontakts; wer verifiziert, wird Owner. */
export async function verifyContact(deps: Deps, actor: NamedActor, journalistId: string) {
  assert(canEditContact(actor));
  const missing = await missingForVerification(deps.db, journalistId);
  if (missing.length) throw new DomainError(t.journo.verifyMissing(missing.join(", ")));
  const now = deps.now();
  await deps.db.journalist.update({
    where: { id: journalistId },
    data: { status: "VERIFIZIERT", verifiedBy: actor.id, verifiedAt: now, lastActivityAt: now, updatedBy: actor.id },
  });
  await addOwnerRow(deps, journalistId, actor.id, actor);
  await writeAudit(deps.db, { actorId: actor.id, action: AuditAction.CONTACT_VERIFIED, entity: "Journalist", entityId: journalistId });
}

/** CVDs entziehen eine Verifizierung mit Grund; der Kontakt fällt auf Manuell zurück (DECISIONS D-088). */
export async function revokeVerification(deps: Deps, actor: Actor, journalistId: string, reason: string) {
  assert(canRevokeVerificationOrDeleteContact(actor));
  const contact = await requireContact(deps.db, journalistId);
  const text = reason.trim();
  if (!text) throw new DomainError(t.journo.errors.reasonRequired);
  if (contact.status !== "VERIFIZIERT") return;
  await deps.db.journalist.update({ where: { id: journalistId }, data: { status: "MANUELL", verifiedBy: null, verifiedAt: null, updatedBy: actor.id } });
  await writeAudit(deps.db, {
    actorId: actor.id,
    action: AuditAction.CONTACT_VERIFICATION_REVOKED,
    entity: "Journalist",
    entityId: journalistId,
    before: { verifiedBy: contact.verifiedBy },
    after: { reason: text.slice(0, 500) },
  });
}

// ------------------------------------------------------------- Owner

/**
 * Owner eintragen: bis zu 3 aktive, ein weiterer wartet auf einen CVD. Inaktive Owner (nach Offboarding)
 * bleiben sichtbar, bis ein neuer Owner eingetragen ist (BRIEFING 6.9).
 */
async function addOwnerRow(deps: Deps, journalistId: string, userId: string, actor: Actor): Promise<{ pending: boolean }> {
  const existing = await deps.db.contactOwner.findUnique({ where: { journalistId_userId: { journalistId, userId } } });
  if (existing?.active && !existing.pendingApproval) return { pending: false };
  const activeCount = (await activeOwnerIds(deps.db, journalistId)).length;
  const pending = activeCount >= MAX_ACTIVE_OWNERS;
  const now = deps.now();
  await deps.db.$transaction(async (tx) => {
    if (existing) await tx.contactOwner.update({ where: { id: existing.id }, data: { active: true, pendingApproval: pending, since: now, updatedBy: actor.id } });
    else await tx.contactOwner.create({ data: { journalistId, userId, since: now, pendingApproval: pending, createdBy: actor.id, updatedBy: actor.id } });
    if (!pending) await tx.contactOwner.deleteMany({ where: { journalistId, active: false } });
    await tx.journalist.update({ where: { id: journalistId }, data: { lastActivityAt: now } });
  });
  if (pending) {
    const user = await deps.db.user.findUnique({ where: { id: userId }, select: { name: true } });
    const cvds = await deps.db.user.findMany({ where: { role: "CVD", active: true } });
    for (const cvd of cvds) {
      await notify(deps, { userId: cvd.id, kind: "CONTACT_OWNER_APPROVAL", title: t.journo.notifications.ownerApproval(user?.name ?? ""), link: `/journo-hub/${journalistId}`, push: false });
    }
  }
  return { pending };
}

/** Nach erfolgreichem Kontakt trägt sich der Anfragende selbst als Owner ein (BRIEFING 6.7 Schritt 6). */
export async function becomeOwner(deps: Deps, actor: NamedActor, journalistId: string) {
  assert(canEditContact(actor));
  await requireContact(deps.db, journalistId);
  if ((await activeOwnerIds(deps.db, journalistId)).includes(actor.id)) throw new DomainError(t.journo.errors.alreadyOwner);
  const contacted =
    isCvd(actor) ||
    (await deps.db.contactAccessGrant.count({ where: { journalistId, userId: actor.id } })) > 0 ||
    (await deps.db.contactRequest.count({ where: { journalistId, requesterId: actor.id, status: "FREIGEGEBEN" } })) > 0;
  if (!contacted) throw new DomainError(t.journo.errors.noContactYet);
  return addOwnerRow(deps, journalistId, actor.id, actor);
}

export async function approvePendingOwner(deps: Deps, actor: Actor, ownerId: string) {
  assert(isCvd(actor));
  if (!uuid.safeParse(ownerId).success) throw new NotFoundError(t.errors.notFound);
  const owner = await deps.db.contactOwner.findUnique({ where: { id: ownerId } });
  if (!owner?.pendingApproval) throw new NotFoundError(t.errors.notFound);
  await deps.db.contactOwner.update({ where: { id: ownerId }, data: { pendingApproval: false, updatedBy: actor.id } });
  await deps.db.contactOwner.deleteMany({ where: { journalistId: owner.journalistId, active: false } });
  await writeAudit(deps.db, { actorId: actor.id, action: AuditAction.CONTACT_OWNER_APPROVED, entity: "Journalist", entityId: owner.journalistId, after: { userId: owner.userId } });
}

export const relationSchema = z.object({
  relationNote: optionalText(1000),
  relationQuality: z.enum(["GUT", "NEUTRAL", "SCHWIERIG"]).nullish().transform((v) => v ?? null),
});

/** Beziehungsnotiz und -qualität pflegt der Owner selbst. */
export async function setRelation(deps: Deps, actor: Actor, journalistId: string, raw: z.input<typeof relationSchema>) {
  const input = relationSchema.parse(raw);
  const owner = uuid.safeParse(journalistId).success ? await deps.db.contactOwner.findUnique({ where: { journalistId_userId: { journalistId, userId: actor.id } } }) : null;
  if (!owner) throw new DomainError(t.journo.errors.notOwner);
  await deps.db.contactOwner.update({ where: { id: owner.id }, data: { ...input, updatedBy: actor.id } });
}

// ------------------------------------------------------------- Medien

export const mediaSchema = z.object({
  name: z.string().trim().min(1, t.journo.errors.mediaNameRequired).max(120),
  type: z.enum(["LEITMEDIUM", "REGIONAL", "FACH", "AGENTUR", "RUNDFUNK", "ONLINE"]),
  desks: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
});

export async function saveMedia(deps: Deps, actor: Actor, mediaId: string | null, raw: z.input<typeof mediaSchema>) {
  assert(canEditContact(actor));
  const input = mediaSchema.parse(raw);
  const clash = await deps.db.media.findFirst({ where: { name: { equals: input.name, mode: "insensitive" }, id: mediaId ? { not: mediaId } : undefined } });
  if (clash) throw new DomainError(t.journo.errors.mediaTaken);
  if (mediaId) return deps.db.media.update({ where: { id: mediaId }, data: { ...input, updatedBy: actor.id } });
  return deps.db.media.create({ data: { ...input, createdBy: actor.id, updatedBy: actor.id } });
}

/** Medium per Name finden oder anlegen (Import, Pressespiegel); neue Medien sind zunächst Online (DECISIONS D-089). */
export async function mediaByName(db: Db, name: string, actorId: string): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return null;
  const existing = await db.media.findFirst({ where: { name: { equals: clean, mode: "insensitive" } } });
  if (existing) return existing.id;
  return (await db.media.create({ data: { name: clean, type: "ONLINE", desks: [], createdBy: actorId, updatedBy: actorId } })).id;
}
