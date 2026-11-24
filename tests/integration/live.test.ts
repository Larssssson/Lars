import { beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { createPrismaClient } from "@/lib/db";
import { deleteClient } from "@/lib/domain/clients/service";
import { DomainError } from "@/lib/domain/errors";
import { ForbiddenError } from "@/lib/domain/permissions";
import { createUser, deleteUser } from "@/lib/domain/permissions/admin";
import { changeOwnPassword, checkPasswordLogin, MAX_FAILED_LOGINS, resetPassword } from "@/lib/domain/permissions/passwords";
import { applyInitialPasswords, liveResetOnce } from "@/prisma/live-reset";
import { seed } from "@/prisma/seed";
import { clientByName, FIXED_NOW, resetAndSeed, testDeps, userByKey, usersByKey, type TestDeps } from "./helpers";

const db = createPrismaClient();
let deps: TestDeps;

beforeEach(async () => {
  await resetAndSeed(db);
  deps = await testDeps(db);
});

describe("Passwort-Login (D-125)", () => {
  it("Vorname oder voller Name, Sperre nach Fehlversuchen, neues Passwort nur durch CVD", async () => {
    const [lars, laura, valentin] = await usersByKey(db, ["lars", "laura", "valentin"]);
    await expect(resetPassword(deps, laura, lars.id)).rejects.toThrow(ForbiddenError);
    const pw = await resetPassword(deps, lars, laura.id);
    expect(pw).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!#%+?@]).{8}$/);
    expect((await db.user.findUniqueOrThrow({ where: { id: laura.id } })).passwordHash).not.toContain(pw);

    expect(await checkPasswordLogin(db, FIXED_NOW, "laura", pw)).toMatchObject({ id: laura.id });
    expect(await checkPasswordLogin(db, FIXED_NOW, "Laura", "falsch")).toBeNull();
    expect(await checkPasswordLogin(db, FIXED_NOW, "Niemand", pw)).toBeNull();

    const vpw = await resetPassword(deps, lars, valentin.id);
    expect(await checkPasswordLogin(db, FIXED_NOW, "Valentin", vpw)).toMatchObject({ id: valentin.id });
    expect(await checkPasswordLogin(db, FIXED_NOW, "valentin abel", vpw)).toMatchObject({ id: valentin.id });

    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await checkPasswordLogin(db, FIXED_NOW, "Laura", "falsch");
    expect(await checkPasswordLogin(db, FIXED_NOW, "Laura", pw)).toBeNull();
    expect(await checkPasswordLogin(db, new Date(FIXED_NOW.getTime() + 16 * 60_000), "Laura", pw)).toMatchObject({ id: laura.id });

    await expect(changeOwnPassword(deps, laura, "falsch", "NeuesPasswort1")).rejects.toThrow(DomainError);
    await expect(changeOwnPassword(deps, laura, pw, "kurz")).rejects.toThrow(DomainError);
    await changeOwnPassword(deps, laura, pw, "NeuesPasswort1");
    expect(await checkPasswordLogin(db, FIXED_NOW, "Laura", "NeuesPasswort1")).toMatchObject({ id: laura.id });

    await setUserBlocked(laura.id);
    expect(await checkPasswordLogin(db, FIXED_NOW, "Laura", "NeuesPasswort1")).toBeNull();
    expect(await db.auditLog.count({ where: { action: { in: ["PASSWORD_SET", "PASSWORD_CHANGED"] } } })).toBe(3);
  });
});

async function setUserBlocked(id: string) {
  await db.user.update({ where: { id }, data: { active: false } });
}

describe("Nutzer und Kunden löschen (D-126)", () => {
  it("nur Admin löscht Nutzer; mit Aufgaben erst Offboarding", async () => {
    const [lars, laura, robin] = await usersByKey(db, ["lars", "laura", "robin"]);
    const fresh = await createUser(deps, lars, { name: "Testperson", email: "test@example.com", role: "REDAKTEUR" });
    await expect(deleteUser(deps, laura, fresh.id)).rejects.toThrow(ForbiddenError);
    await expect(deleteUser(deps, lars, lars.id)).rejects.toThrow(DomainError);
    await deleteUser(deps, lars, fresh.id);
    expect(await db.user.findUnique({ where: { id: fresh.id } })).toBeNull();
    const robinTasks = await db.task.count({ where: { ownerId: robin.id } });
    if (robinTasks) await expect(deleteUser(deps, lars, robin.id)).rejects.toThrow(/Offboarding/);
    expect(await db.auditLog.count({ where: { action: "USER_DELETED", entityId: fresh.id } })).toBe(1);
  });

  it("Kunde mit allen Inhalten löschen, nur mit eingetipptem Namen, nicht RP intern", async () => {
    const [lars, laura] = await usersByKey(db, ["lars", "laura"]);
    const covenant = await clientByName(db, "Covenant");
    expect(await db.task.count({ where: { clientId: covenant.id } })).toBeGreaterThan(0);
    await expect(deleteClient(deps, laura, covenant.id, "Covenant")).rejects.toThrow(ForbiddenError);
    await expect(deleteClient(deps, lars, covenant.id, "Falsch")).rejects.toThrow(DomainError);
    await db.user.update({ where: { id: laura.id }, data: { selectedClientId: covenant.id } });
    await deleteClient(deps, lars, covenant.id, "covenant");
    expect(await db.client.findUnique({ where: { id: covenant.id } })).toBeNull();
    expect(await db.task.count({ where: { clientId: covenant.id } })).toBe(0);
    expect((await userByKey(db, "laura")).selectedClientId).toBeNull();
    const internal = await db.client.findFirstOrThrow({ where: { isInternal: true } });
    await expect(deleteClient(deps, lars, internal.id, internal.name)).rejects.toThrow(DomainError);
  });
});

describe("Live-Start (D-131)", () => {
  it("leert einmal alle Inhalte, behält Nutzer und Konfiguration, setzt nur fehlende Startpasswörter", async () => {
    const users = await db.user.count();
    const formats = await db.documentFormat.count();
    const result = await liveResetOnce(db, FIXED_NOW);
    expect(result).not.toBeNull();
    expect(await db.task.count()).toBe(0);
    expect(await db.journalist.count()).toBe(0);
    expect(await db.client.count()).toBe(1); // RP intern
    expect(await db.user.count()).toBe(users);
    expect(await db.documentFormat.count()).toBe(formats);

    await seed(db, FIXED_NOW, {}, { samples: false });
    expect(await db.client.count()).toBe(1);
    expect(await db.task.count()).toBe(0);
    expect(await liveResetOnce(db, FIXED_NOW)).toBeNull();

    const hash = await hashPassword("Start123!");
    expect(await applyInitialPasswords(db, JSON.stringify({ Lars: hash, Unbekannt: hash }))).toBe(1);
    const lars = await userByKey(db, "lars");
    expect(await checkPasswordLogin(db, FIXED_NOW, "Lars", "Start123!")).toMatchObject({ id: lars.id });
    // zweiter Start überschreibt nichts
    expect(await applyInitialPasswords(db, JSON.stringify({ Lars: await hashPassword("anders") }))).toBe(0);
  });
});
