import { z } from "zod";
import { t } from "@/i18n";
import { AuditAction, writeAudit } from "@/lib/domain/audit";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import type { Permission, Role, User } from "@/lib/generated/prisma/client";
import { assert, canGrantPermission, canManageUsers, type Actor } from "./index";

/**
 * Nutzerverwaltung (BRIEFING 3, 7.10): nur CVDs. Jede Rechteänderung wird mit Datum
 * und Vergeber protokolliert. Offboarding folgt in Phase 4.
 */
export const userSchema = z.object({
  name: z.string().trim().min(1, t.admin.errors.nameRequired).max(120),
  email: z.email(t.admin.errors.emailInvalid).transform((v) => v.trim().toLowerCase()),
  role: z.enum(["REDAKTEUR", "CVD"]),
  isAdmin: z.boolean().default(false),
});

async function requireUser(deps: Deps, userId: string): Promise<User> {
  const user = await deps.db.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError(t.errors.notFound);
  return user;
}

export async function createUser(deps: Deps, actor: Actor, raw: z.input<typeof userSchema>): Promise<User> {
  assert(canManageUsers(actor));
  const input = userSchema.parse(raw);
  const existing = await deps.db.user.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } } });
  if (existing) throw new DomainError(t.admin.errors.emailTaken);
  const user = await deps.db.user.create({ data: { ...input, createdBy: actor.id, updatedBy: actor.id } });
  await writeAudit(deps.db, {
    actorId: actor.id,
    action: AuditAction.USER_CREATED,
    entity: "User",
    entityId: user.id,
    after: { role: user.role, isAdmin: user.isAdmin },
  });
  return user;
}

/** Grundrolle und Admin-Merkmal ändern. Die eigene Rolle ändert niemand selbst. */
export async function setUserRole(deps: Deps, actor: Actor, userId: string, role: Role, isAdmin: boolean): Promise<User> {
  assert(canManageUsers(actor));
  if (userId === actor.id) throw new DomainError(t.admin.errors.notOnSelf);
  const before = await requireUser(deps, userId);
  const user = await deps.db.user.update({ where: { id: userId }, data: { role, isAdmin, updatedBy: actor.id } });
  await writeAudit(deps.db, {
    actorId: actor.id,
    action: AuditAction.USER_ROLE_CHANGED,
    entity: "User",
    entityId: userId,
    before: { role: before.role, isAdmin: before.isAdmin },
    after: { role, isAdmin },
  });
  return user;
}

/** Zugang sperren oder entsperren; gesperrte Nutzer verlieren sofort den Zugang (BRIEFING 11). */
export async function setUserActive(deps: Deps, actor: Actor, userId: string, active: boolean): Promise<User> {
  assert(canManageUsers(actor));
  if (userId === actor.id) throw new DomainError(t.admin.errors.notOnSelf);
  await requireUser(deps, userId);
  const user = await deps.db.user.update({
    where: { id: userId },
    data: { active, deactivatedAt: active ? null : deps.now(), updatedBy: actor.id },
  });
  await writeAudit(deps.db, {
    actorId: actor.id,
    action: active ? AuditAction.USER_UNBLOCKED : AuditAction.USER_BLOCKED,
    entity: "User",
    entityId: userId,
  });
  return user;
}

/**
 * Zusatzrecht vergeben (BRIEFING 3.3). Freigaberecht braucht einen Kunden; Selbstfreigabe ist
 * standardmäßig aus und kann nicht an sich selbst vergeben werden.
 */
export async function grantPermission(
  deps: Deps,
  actor: Actor,
  input: { userId: string; permission: Permission; clientId: string | null },
): Promise<void> {
  assert(canGrantPermission(actor, input));
  await requireUser(deps, input.userId);
  if (input.permission === "APPROVE" && !input.clientId) throw new DomainError(t.admin.errors.clientRequiredForApprove);
  if (input.clientId) {
    const client = await deps.db.client.findUnique({ where: { id: input.clientId } });
    if (!client) throw new NotFoundError(t.errors.notFound);
  }
  const existing = await deps.db.permissionGrant.findFirst({
    where: { userId: input.userId, permission: input.permission, clientId: input.clientId, revokedAt: null },
  });
  if (existing) return;
  const grant = await deps.db.permissionGrant.create({
    data: {
      userId: input.userId,
      permission: input.permission,
      clientId: input.clientId,
      grantedById: actor.id,
      grantedAt: deps.now(),
      createdBy: actor.id,
      updatedBy: actor.id,
    },
  });
  await writeAudit(deps.db, {
    actorId: actor.id,
    action: AuditAction.PERMISSION_GRANTED,
    entity: "PermissionGrant",
    entityId: input.userId,
    after: { grantId: grant.id, permission: input.permission, clientId: input.clientId },
  });
}

export async function revokePermission(deps: Deps, actor: Actor, grantId: string): Promise<void> {
  assert(canManageUsers(actor));
  const grant = await deps.db.permissionGrant.findUnique({ where: { id: grantId } });
  if (!grant || grant.revokedAt) throw new NotFoundError(t.errors.notFound);
  await deps.db.permissionGrant.update({ where: { id: grantId }, data: { revokedAt: deps.now(), updatedBy: actor.id } });
  await writeAudit(deps.db, {
    actorId: actor.id,
    action: AuditAction.PERMISSION_REVOKED,
    entity: "PermissionGrant",
    entityId: grant.userId,
    before: { grantId, permission: grant.permission, clientId: grant.clientId },
  });
}

/** Protokoll der Rechteänderungen für die Verwaltung (BRIEFING 7.10). */
export function listAudit(deps: Pick<Deps, "db">, filter: { entity?: string | null; limit?: number } = {}) {
  return deps.db.auditLog.findMany({
    where: { entity: filter.entity ?? undefined },
    orderBy: { at: "desc" },
    take: filter.limit ?? 200,
  });
}
