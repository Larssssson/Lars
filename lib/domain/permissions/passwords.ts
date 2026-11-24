import { t } from "@/i18n";
import { AuditAction, writeAudit } from "@/lib/domain/audit";
import { hashPassword, MIN_PASSWORD_LENGTH, generatePassword, verifyPassword } from "@/lib/auth/password";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { assert, canManageUsers, type Actor } from "./index";

/** Nach so vielen Fehlversuchen ist das Konto für LOCK_MINUTES gesperrt (DECISIONS D-125). */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

// Vergleichswert, damit unbekannte Namen gleich lange brauchen wie falsche Passwörter
let dummyHash: Promise<string> | undefined;

/**
 * Anmeldung mit Name und Passwort. Der Name ist der Vorname oder der volle Name (ohne Groß-/Kleinschreibung);
 * passt ein Vorname auf mehrere aktive Personen, gilt nur der volle Name.
 */
export async function checkPasswordLogin(db: PrismaClient, now: Date, name: string, password: string) {
  const wanted = name.trim().toLowerCase();
  const users = await db.user.findMany({ where: { active: true }, select: { id: true, name: true, email: true, passwordHash: true, failedLogins: true, lockedUntil: true } });
  const exact = users.filter((u) => u.name.toLowerCase() === wanted);
  const byFirst = users.filter((u) => u.name.split(/\s+/)[0]!.toLowerCase() === wanted);
  const user = exact.length === 1 ? exact[0] : byFirst.length === 1 ? byFirst[0] : undefined;
  if (!user || !user.passwordHash) {
    await verifyPassword(password, await (dummyHash ??= hashPassword("kein-konto")));
    return null;
  }
  if (user.lockedUntil && user.lockedUntil > now) return null;
  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : user.lockedUntil },
    });
    return null;
  }
  if (user.failedLogins || user.lockedUntil) await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  return { id: user.id, name: user.name, email: user.email };
}

/** Neues Zufallspasswort für eine Person (CVD in der Verwaltung). Wird genau einmal angezeigt. */
export async function resetPassword(deps: Deps, actor: Actor, userId: string): Promise<string> {
  assert(canManageUsers(actor));
  const user = await deps.db.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError(t.errors.notFound);
  const password = generatePassword();
  await deps.db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null, updatedBy: actor.id } });
  await writeAudit(deps.db, { actorId: actor.id, action: AuditAction.PASSWORD_SET, entity: "User", entityId: userId });
  return password;
}

/** Eigenes Passwort ändern: altes Passwort nötig, neues mindestens 8 Zeichen. */
export async function changeOwnPassword(deps: Deps, actor: Actor, current: string, next: string) {
  assert(actor.active);
  const user = await deps.db.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifyPassword(current, user.passwordHash))) throw new DomainError(t.auth.password.wrongCurrent);
  if (next.length < MIN_PASSWORD_LENGTH) throw new DomainError(t.auth.password.tooShort(MIN_PASSWORD_LENGTH));
  await deps.db.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(next), updatedBy: actor.id } });
  await writeAudit(deps.db, { actorId: actor.id, action: AuditAction.PASSWORD_CHANGED, entity: "User", entityId: actor.id });
}
