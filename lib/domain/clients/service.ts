import { z } from "zod";
import { t } from "@/i18n";
import { AuditAction, writeAudit } from "@/lib/domain/audit";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { notify } from "@/lib/domain/notifications";
import { assert, canManageClients, canManageUsers, type Actor } from "@/lib/domain/permissions";
import type { Client, ClientStatus, MemberKind } from "@/lib/generated/prisma/client";
import { ensureClientFolders } from "@/lib/domain/documents/filing";
import { warningsForClient } from "./warnings";

export const clientSchema = z.object({
  name: z.string().trim().min(1, t.clients.errors.nameRequired).max(120),
  shortName: z
    .string()
    .trim()
    .min(1, t.clients.errors.shortNameRequired)
    .max(40)
    .regex(/^[\p{L}\p{N} _-]+$/u, t.clients.errors.shortNameInvalid),
  industry: z.string().trim().max(120).nullish().transform((v) => v || null),
  cluster: z.string().trim().max(60).nullish().transform((v) => v || null),
  aiAllowed: z.boolean().default(true),
});

export type ClientInput = z.input<typeof clientSchema>;

async function requireClient(deps: Deps, clientId: string): Promise<Client> {
  if (!z.uuid().safeParse(clientId).success) throw new NotFoundError(t.errors.notFound);
  const client = await deps.db.client.findUnique({ where: { id: clientId } });
  if (!client) throw new NotFoundError(t.errors.notFound);
  return client;
}

async function ensureUniqueShortName(deps: Deps, shortName: string, exceptId?: string) {
  const existing = await deps.db.client.findFirst({
    where: { shortName: { equals: shortName, mode: "insensitive" }, id: exceptId ? { not: exceptId } : undefined },
  });
  if (existing) throw new DomainError(t.clients.errors.shortNameTaken);
}

/** Kunden anlegen (BRIEFING 6.8 Schritt 1): Status Onboarding, optional mit Kunden-Lead. */
export async function createClient(deps: Deps, actor: Actor, raw: ClientInput, leadUserId?: string | null): Promise<Client> {
  assert(canManageClients(actor));
  const input = clientSchema.parse(raw);
  await ensureUniqueShortName(deps, input.shortName);
  // Ordnerstruktur im SharePoint beim Anlegen (BRIEFING 9)
  const folder = await ensureClientFolders(deps.documents, input.shortName);
  const client = await deps.db.client.create({
    data: { ...input, status: "ONBOARDING", sharePointFolderPath: folder, createdBy: actor.id, updatedBy: actor.id },
  });
  await writeAudit(deps.db, { actorId: actor.id, action: AuditAction.CLIENT_CREATED, entity: "Client", entityId: client.id, after: { name: client.name } });
  if (leadUserId) await setMembership(deps, actor, { clientId: client.id, userId: leadUserId, kind: "LEAD", canApprove: false });
  return client;
}

/** Stammdaten ändern (BRIEFING 7.7: Stammdaten pflegt der CVD). */
export async function updateClient(deps: Deps, actor: Actor, clientId: string, raw: ClientInput): Promise<Client> {
  assert(canManageClients(actor));
  const before = await requireClient(deps, clientId);
  const input = clientSchema.parse(raw);
  await ensureUniqueShortName(deps, input.shortName, clientId);
  const client = await deps.db.client.update({ where: { id: clientId }, data: { ...input, updatedBy: actor.id } });
  await writeAudit(deps.db, {
    actorId: actor.id,
    action: AuditAction.CLIENT_UPDATED,
    entity: "Client",
    entityId: clientId,
    before: { name: before.name, shortName: before.shortName, aiAllowed: before.aiAllowed },
    after: { name: client.name, shortName: client.shortName, aiAllowed: client.aiAllowed },
  });
  return client;
}

/**
 * Status setzen: archivieren, wiederherstellen (zurück ins Onboarding) und Onboarding → Aktiv.
 * Die Prüfung der Pflichtabschnitte vor Aktiv kommt mit dem Kundenprofil in Phase 3 (DECISIONS D-046).
 */
export async function setClientStatus(deps: Deps, actor: Actor, clientId: string, status: ClientStatus): Promise<Client> {
  assert(canManageClients(actor));
  const before = await requireClient(deps, clientId);
  const allowed: Record<ClientStatus, ClientStatus[]> = {
    ONBOARDING: ["AKTIV", "ARCHIVIERT"],
    AKTIV: ["ARCHIVIERT"],
    ARCHIVIERT: ["ONBOARDING"],
  };
  if (!allowed[before.status].includes(status)) throw new DomainError(t.clients.errors.statusInvalid);
  const client = await deps.db.$transaction(async (tx) => {
    const updated = await tx.client.update({ where: { id: clientId }, data: { status, updatedBy: actor.id } });
    // archivierte Kunden verschwinden aus der Kundenauswahl
    if (status === "ARCHIVIERT") await tx.user.updateMany({ where: { selectedClientId: clientId }, data: { selectedClientId: null } });
    return updated;
  });
  await writeAudit(deps.db, {
    actorId: actor.id,
    action: AuditAction.CLIENT_STATUS_CHANGED,
    entity: "Client",
    entityId: clientId,
    before: { status: before.status },
    after: { status },
  });
  return client;
}

/** Logo hochladen (Stammdaten, BRIEFING 7.7). Nur Bilder. */
export async function setClientLogo(
  deps: Deps,
  actor: Actor,
  clientId: string,
  file: { name: string; mimeType: string; data: Uint8Array },
): Promise<void> {
  assert(canManageClients(actor));
  await requireClient(deps, clientId);
  // PNG oder JPEG, weil Word kein SVG zuverlässig einbettet (DECISIONS D-056)
  if (!["image/png", "image/jpeg"].includes(file.mimeType)) throw new DomainError(t.clients.errors.logoType);
  if (file.data.byteLength > 2 * 1024 * 1024) throw new DomainError(t.clients.errors.logoSize);
  const storageKey = `clients/${clientId}/logo-${crypto.randomUUID()}`;
  await deps.files.put(storageKey, file.data, file.mimeType);
  const stored = await deps.db.file.create({
    data: { storageKey, name: file.name, mimeType: file.mimeType, size: file.data.byteLength, clientId, uploadedBy: actor.id, createdBy: actor.id },
  });
  await deps.db.client.update({ where: { id: clientId }, data: { logoFileId: stored.id, updatedBy: actor.id } });
}

/**
 * Zuordnung Nutzer zu Kunde setzen (BRIEFING 3.2). Kunden-Lead und dessen Freigaberecht
 * setzt nur ein CVD; jede Änderung wird als Rechteänderung protokolliert.
 */
export async function setMembership(
  deps: Deps,
  actor: Actor,
  input: { clientId: string; userId: string; kind: MemberKind; canApprove: boolean },
): Promise<void> {
  assert(canManageUsers(actor));
  await requireClient(deps, input.clientId);
  if (!z.uuid().safeParse(input.userId).success) throw new NotFoundError(t.errors.notFound);
  const user = await deps.db.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new NotFoundError(t.errors.notFound);
  const canApprove = input.kind === "LEAD" && input.canApprove;
  const before = await deps.db.clientMember.findUnique({ where: { clientId_userId: { clientId: input.clientId, userId: input.userId } } });
  await deps.db.clientMember.upsert({
    where: { clientId_userId: { clientId: input.clientId, userId: input.userId } },
    update: { kind: input.kind, canApprove, updatedBy: actor.id },
    create: { clientId: input.clientId, userId: input.userId, kind: input.kind, canApprove, createdBy: actor.id, updatedBy: actor.id },
  });
  await writeAudit(deps.db, {
    actorId: actor.id,
    action: AuditAction.MEMBERSHIP_SET,
    entity: "ClientMember",
    entityId: input.userId,
    before: before ? { clientId: before.clientId, kind: before.kind, canApprove: before.canApprove } : undefined,
    after: { clientId: input.clientId, kind: input.kind, canApprove },
  });
}

export async function removeMembership(deps: Deps, actor: Actor, clientId: string, userId: string): Promise<void> {
  assert(canManageUsers(actor));
  const before = await deps.db.clientMember.findUnique({ where: { clientId_userId: { clientId, userId } } });
  if (!before) return;
  await deps.db.clientMember.delete({ where: { id: before.id } });
  await writeAudit(deps.db, {
    actorId: actor.id,
    action: AuditAction.MEMBERSHIP_REMOVED,
    entity: "ClientMember",
    entityId: userId,
    before: { clientId, kind: before.kind, canApprove: before.canApprove },
  });
}

/**
 * Job täglich: Profilwarnungen und Leistungsrückstand in die Glocke (BRIEFING 7.9) für
 * Kunden-Lead und CVDs, ohne Push. Dieselbe Warnung höchstens einmal in 7 Tagen.
 */
export async function notifyClientWarnings(deps: Deps): Promise<number> {
  const now = deps.now();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const [clients, cvds] = await Promise.all([
    deps.db.client.findMany({ where: { status: "AKTIV" }, include: { members: { where: { kind: "LEAD" } } } }),
    deps.db.user.findMany({ where: { role: "CVD", active: true }, select: { id: true } }),
  ]);
  let created = 0;
  for (const client of clients) {
    const recipients = new Set([...cvds.map((u) => u.id), ...client.members.map((m) => m.userId)]);
    for (const warning of await warningsForClient(deps.db, client, now)) {
      const kind = warning.kind === "SERVICE_BEHIND" ? "SERVICE_BACKLOG" : "PROFILE_WARNING";
      const title = `${client.name}: ${warning.text}`;
      for (const userId of recipients) {
        const recent = await deps.db.notification.findFirst({ where: { userId, kind, title, createdAt: { gte: weekAgo } } });
        if (recent) continue;
        await notify(deps, { userId, kind, title, link: warning.link, push: false });
        created += 1;
      }
    }
  }
  return created;
}
