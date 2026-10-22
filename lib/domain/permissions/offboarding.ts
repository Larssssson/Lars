import { z } from "zod";
import { t } from "@/i18n";
import { AuditAction, writeAudit } from "@/lib/domain/audit";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { notify } from "@/lib/domain/notifications";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { setUserActive } from "./admin";
import { assert, canManageUsers, type Actor, type NamedActor } from "./index";

const uuid = z.uuid();
const OPEN = { notIn: ["ERLEDIGT", "ARCHIVIERT"] as ("ERLEDIGT" | "ARCHIVIERT")[] };

async function requireUser(db: PrismaClient, userId: string) {
  if (!uuid.safeParse(userId).success) throw new NotFoundError(t.errors.notFound);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError(t.errors.notFound);
  return user;
}

/** Offboarding (BRIEFING 6.9 Schritt 2): offene Aufgaben und Kontakte, deren Owner die Person ist. */
export async function offboardingOverview(db: PrismaClient, actor: Actor, userId: string) {
  assert(canManageUsers(actor));
  const user = await requireUser(db, userId);
  const [tasks, contacts] = await Promise.all([
    db.task.findMany({ where: { ownerId: userId, status: OPEN }, include: { client: { select: { name: true } } }, orderBy: { dueAt: "asc" } }),
    db.contactOwner.findMany({
      where: { userId, active: true },
      include: { journalist: { select: { id: true, firstName: true, lastName: true, media: { select: { name: true } } } } },
      orderBy: { journalist: { lastName: "asc" } },
    }),
  ]);
  return { user, tasks, contacts };
}

/** Schritt 3: neuer Owner für eine offene Aufgabe. */
export async function reassignTask(deps: Deps, actor: NamedActor, offboardUserId: string, taskId: string, newOwnerId: string) {
  assert(canManageUsers(actor));
  const task = uuid.safeParse(taskId).success ? await deps.db.task.findFirst({ where: { id: taskId, ownerId: offboardUserId } }) : null;
  if (!task) throw new NotFoundError(t.errors.notFound);
  const owner = uuid.safeParse(newOwnerId).success ? await deps.db.user.findFirst({ where: { id: newOwnerId, active: true, NOT: { id: offboardUserId } } }) : null;
  if (!owner) throw new DomainError(t.admin.offboarding.ownerRequired);
  await deps.db.task.update({ where: { id: task.id }, data: { ownerId: owner.id, updatedBy: actor.id } });
  if (owner.id !== actor.id) {
    await notify(deps, { userId: owner.id, kind: "TASK_ASSIGNED", title: t.notifications.taskAssigned(task.title), link: `/aufgaben/${task.id}`, push: false });
  }
}

export type ContactResolution = { kind: "TRANSFER"; userId: string } | { kind: "NOTE"; note: string } | { kind: "INACTIVE" };

/** Schritt 3 für Kontakte: Owner übertragen, Notiz hinterlassen oder als inaktiven Owner stehen lassen. */
export async function resolveOwnedContact(deps: Deps, actor: NamedActor, offboardUserId: string, ownerRowId: string, resolution: ContactResolution) {
  assert(canManageUsers(actor));
  const row = uuid.safeParse(ownerRowId).success ? await deps.db.contactOwner.findFirst({ where: { id: ownerRowId, userId: offboardUserId } }) : null;
  if (!row) throw new NotFoundError(t.errors.notFound);
  const now = deps.now();
  if (resolution.kind === "TRANSFER") {
    const target = uuid.safeParse(resolution.userId).success ? await deps.db.user.findFirst({ where: { id: resolution.userId, active: true, NOT: { id: offboardUserId } } }) : null;
    if (!target) throw new DomainError(t.admin.offboarding.ownerRequired);
    const already = await deps.db.contactOwner.findUnique({ where: { journalistId_userId: { journalistId: row.journalistId, userId: target.id } } });
    await deps.db.$transaction(async (tx) => {
      if (already) {
        await tx.contactOwner.update({ where: { id: already.id }, data: { active: true, pendingApproval: false, updatedBy: actor.id } });
        await tx.contactOwner.delete({ where: { id: row.id } });
      } else {
        await tx.contactOwner.update({ where: { id: row.id }, data: { userId: target.id, since: now, relationNote: null, relationQuality: null, active: true, updatedBy: actor.id } });
      }
      // ein neuer Owner ist eingetragen: inaktive Owner verschwinden (BRIEFING 6.9 Schritt 4)
      await tx.contactOwner.deleteMany({ where: { journalistId: row.journalistId, active: false } });
    });
    return;
  }
  if (resolution.kind === "NOTE") {
    const note = resolution.note.trim();
    if (!note) throw new DomainError(t.journo.errors.reasonRequired);
    const user = await requireUser(deps.db, offboardUserId);
    const contact = await deps.db.journalist.findUniqueOrThrow({ where: { id: row.journalistId } });
    await deps.db.journalist.update({
      where: { id: contact.id },
      data: { notes: [contact.notes, t.admin.offboarding.noteText(user.name, note)].filter(Boolean).join("\n"), updatedBy: actor.id },
    });
  }
  await deps.db.contactOwner.update({ where: { id: row.id }, data: { active: false, updatedBy: actor.id } });
}

/**
 * Abschluss (Schritte 4 und 5): nur ohne offene Aufgaben. Der Zugang wird gesperrt, verbleibende
 * Kontakte behalten die Person als inaktiven Owner.
 */
export async function completeOffboarding(deps: Deps, actor: NamedActor, userId: string) {
  assert(canManageUsers(actor));
  await requireUser(deps.db, userId);
  const open = await deps.db.task.count({ where: { ownerId: userId, status: OPEN } });
  if (open) throw new DomainError(t.admin.offboarding.openTasks(open));
  await deps.db.contactOwner.updateMany({ where: { userId, active: true }, data: { active: false, updatedBy: actor.id } });
  const user = await deps.db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.active) await setUserActive(deps, actor, userId, false);
  await writeAudit(deps.db, { actorId: actor.id, action: AuditAction.USER_OFFBOARDED, entity: "User", entityId: userId });
}
