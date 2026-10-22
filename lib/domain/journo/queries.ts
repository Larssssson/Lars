import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import type { Actor } from "@/lib/domain/permissions";
import { canReveal, maskDetail, requireContact, type RevealContext } from "./contacts";

export type ContactFilter = {
  q?: string | null;
  mediaId?: string | null;
  mediaType?: string | null;
  desk?: string | null;
  topic?: string | null;
  status?: string | null;
  ownerId?: string | null;
};

/**
 * Liste des Journo Hub (BRIEFING 7.5): Name, Medium, Ressort, Themen, Status, Owner, zuletzt
 * geschrieben. Kontaktdaten kommen hier nie mit.
 */
export async function listContacts(db: PrismaClient, filter: ContactFilter = {}) {
  const where: Prisma.JournalistWhereInput = {};
  if (filter.q) where.OR = [{ firstName: { contains: filter.q, mode: "insensitive" } }, { lastName: { contains: filter.q, mode: "insensitive" } }];
  if (filter.mediaId) where.mediaId = filter.mediaId;
  if (filter.mediaType) where.media = { type: filter.mediaType as never };
  if (filter.desk) where.desk = { equals: filter.desk, mode: "insensitive" };
  if (filter.topic) where.topics = { has: filter.topic };
  if (filter.status) where.status = filter.status as never;
  if (filter.ownerId) where.owners = { some: { userId: filter.ownerId } };
  const contacts = await db.journalist.findMany({
    where,
    include: {
      media: { select: { id: true, name: true, type: true } },
      owners: { include: { user: { select: { id: true, name: true } } }, orderBy: { since: "asc" } },
      articles: { select: { publishedAt: true }, orderBy: { publishedAt: "desc" }, take: 1 },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  // verifizierte zuerst, sonst alphabetisch (BRIEFING 7.5: Wert liegt in verifizierten Kontakten)
  return contacts
    .map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      media: c.media,
      desk: c.desk,
      topics: c.topics,
      status: c.status,
      owners: c.owners.map((o) => ({ id: o.user.id, name: o.user.name, active: o.active, pending: o.pendingApproval })),
      lastWrittenAt: c.articles[0]?.publishedAt ?? null,
    }))
    .sort((a, b) => Number(b.status === "VERIFIZIERT") - Number(a.status === "VERIFIZIERT"));
}

/** Werte für die Filter der Liste. */
export async function contactFilterOptions(db: PrismaClient) {
  const [media, journalists, owners] = await Promise.all([
    db.media.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, type: true } }),
    db.journalist.findMany({ select: { desk: true, topics: true } }),
    db.contactOwner.findMany({ distinct: ["userId"], include: { user: { select: { id: true, name: true } } } }),
  ]);
  const sorted = (values: Iterable<string>) => [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b, "de"));
  return {
    media,
    desks: sorted(journalists.map((j) => j.desk ?? "")),
    topics: sorted(journalists.flatMap((j) => j.topics)),
    owners: owners.map((o) => o.user).sort((a, b) => a.name.localeCompare(b.name, "de")),
  };
}

/** Kontaktseite (BRIEFING 7.5) mit verdeckten Kontaktdaten und dem Recht zum Aufdecken. */
export async function contactView(db: PrismaClient, actor: Actor, journalistId: string, context: RevealContext, now: Date) {
  await requireContact(db, journalistId);
  const contact = await db.journalist.findUniqueOrThrow({
    where: { id: journalistId },
    include: {
      media: true,
      contactDetails: { orderBy: [{ kind: "asc" }, { isPrimary: "desc" }] },
      owners: { include: { user: { select: { id: true, name: true, active: true } } }, orderBy: { since: "asc" } },
      articles: { orderBy: { publishedAt: "desc" }, select: { id: true, headline: true, mediaName: true, publishedAt: true, url: true } },
    },
  });
  const userIds = [contact.createdBy, contact.verifiedBy, contact.updatedBy].filter((x): x is string => Boolean(x));
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const name = (id: string | null) => users.find((u) => u.id === id)?.name ?? null;
  const mayReveal = await canReveal(db, actor, journalistId, context, now);
  const activeOwners = contact.owners.filter((o) => o.active && !o.pendingApproval);

  return {
    contact,
    details: contact.contactDetails.map((d) => ({ id: d.id, kind: d.kind, masked: maskDetail(d.kind, d.value), isPrimary: d.isPrimary })),
    owners: contact.owners.map((o) => ({
      id: o.id,
      userId: o.userId,
      name: o.user.name,
      since: o.since,
      active: o.active && o.user.active,
      pending: o.pendingApproval,
      relationNote: o.relationNote,
      relationQuality: o.relationQuality,
    })),
    isOwner: activeOwners.some((o) => o.userId === actor.id),
    mayReveal,
    history: {
      createdBy: name(contact.createdBy),
      createdAt: contact.createdAt,
      verifiedBy: name(contact.verifiedBy),
      verifiedAt: contact.verifiedAt,
      updatedBy: name(contact.updatedBy),
      updatedAt: contact.updatedAt,
    },
    whoKnows: activeOwners.length === 0 && contact.mediaId ? await whoKnows(db, contact.mediaId, journalistId) : null,
  };
}

/** "Wer kennt jemanden bei diesem Medium": verifizierte RP-Kontakte desselben Mediums mit Owner (BRIEFING 7.5). */
export async function whoKnows(db: PrismaClient, mediaId: string, exceptJournalistId?: string) {
  const contacts = await db.journalist.findMany({
    where: { mediaId, status: "VERIFIZIERT", id: exceptJournalistId ? { not: exceptJournalistId } : undefined },
    include: { owners: { where: { active: true, pendingApproval: false }, include: { user: { select: { id: true, name: true } } } } },
    orderBy: { lastName: "asc" },
  });
  return contacts
    .filter((c) => c.owners.length > 0)
    .map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, desk: c.desk, owners: c.owners.map((o) => o.user.name) }));
}
