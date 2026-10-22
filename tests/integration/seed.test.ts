import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "@/lib/db";
import { setSelectedClient } from "@/lib/domain/clients/selection";
import { ForbiddenError } from "@/lib/domain/permissions";
import { bootstrapCvd } from "@/prisma/bootstrap-user";
import { clearSamples } from "@/prisma/clear-samples";
import { seed } from "@/prisma/seed";
import { resetAndSeed, testDeps } from "./helpers";

const db = createPrismaClient();

beforeAll(async () => {
  await resetAndSeed(db);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("Seed (BRIEFING 3.4, 13.1)", () => {
  it("legt die acht Startnutzer mit Rollen an", async () => {
    const users = await db.user.findMany({ orderBy: { email: "asc" } });
    expect(users).toHaveLength(8);
    const cvds = users.filter((u) => u.role === "CVD").map((u) => u.name);
    expect(cvds.sort()).toEqual(["Lars Scholtyssyk", "Lukas"]);
    expect(users.every((u) => u.email.endsWith("@example.com"))).toBe(true);
  });

  it("legt die vier Startkunden mit Status, Leads und Teams an", async () => {
    const clients = await db.client.findMany({ where: { isInternal: false }, include: { members: { include: { user: true } } } });
    const byName = Object.fromEntries(clients.map((c) => [c.name, c]));
    expect(Object.keys(byName).sort()).toEqual(["Covenant", "Ground A", "Rafael", "SAFENET"]);
    expect(byName.SAFENET?.status).toBe("ONBOARDING");
    expect(byName.Covenant?.status).toBe("AKTIV");
    const lead = (name: string) => byName[name]?.members.find((m) => m.kind === "LEAD");
    expect(lead("Covenant")?.user.name).toBe("Lukas");
    expect(lead("Rafael")?.user.name).toBe("Lars Scholtyssyk");
    expect(lead("SAFENET")?.user.name).toBe("Valentin Abel");
    expect(lead("SAFENET")?.canApprove).toBe(true);
    expect(clients.every((c) => c.isSampleData)).toBe(true);
  });

  it("ist idempotent", async () => {
    await seed(db);
    expect(await db.user.count()).toBe(8);
    expect(await db.client.count({ where: { isInternal: false } })).toBe(4);
    expect(await db.client.count({ where: { isInternal: true, isSampleData: false } })).toBe(1);
    expect(await db.documentFormat.count()).toBe(13);
    expect(await db.shiftType.count()).toBe(3);
  });
});

describe("Kundenauswahl (BRIEFING 4)", () => {
  it("speichert die Auswahl pro Nutzer und erlaubt 'Alle Kunden'", async () => {
    const laura = await db.user.findUniqueOrThrow({ where: { email: "laura@example.com" } });
    const covenant = await db.client.findUniqueOrThrow({ where: { shortName: "Covenant" } });
    await setSelectedClient(db, laura, covenant.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: laura.id } })).selectedClientId).toBe(covenant.id);
    await setSelectedClient(db, laura, null);
    expect((await db.user.findUniqueOrThrow({ where: { id: laura.id } })).selectedClientId).toBeNull();
  });

  it("lehnt gesperrte Nutzer und archivierte Kunden ab", async () => {
    const mika = await db.user.findUniqueOrThrow({ where: { email: "mika@example.com" } });
    const rafael = await db.client.findUniqueOrThrow({ where: { shortName: "Rafael" } });
    await expect(setSelectedClient(db, { ...mika, active: false }, rafael.id)).rejects.toThrow(ForbiddenError);
    await db.client.update({ where: { id: rafael.id }, data: { status: "ARCHIVIERT" } });
    await expect(setSelectedClient(db, mika, rafael.id)).rejects.toThrow();
    await db.client.update({ where: { id: rafael.id }, data: { status: "AKTIV" } });
  });
});

describe("Protokoll ist unveränderlich (BRIEFING 11)", () => {
  it("verhindert Ändern und Löschen echter Einträge", async () => {
    const entry = await db.auditLog.create({ data: { action: "TEST", entity: "User" } });
    await expect(db.auditLog.update({ where: { id: entry.id }, data: { action: "X" } })).rejects.toThrow();
    await expect(db.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow();
  });
});

describe("Beispieldaten entfernen (BRIEFING 13)", () => {
  it("löscht Beispieldaten, Nutzer und Konfiguration bleiben", async () => {
    const lars = await db.user.findUniqueOrThrow({ where: { email: "lars@example.com" } });
    const covenant = await db.client.findUniqueOrThrow({ where: { shortName: "Covenant" } });
    await db.user.update({ where: { id: lars.id }, data: { selectedClientId: covenant.id } });

    const deps = await testDeps(db);
    const sampleFile = await db.file.create({ data: { storageKey: "clients/beispiel/logo-seed", name: "logo.png", mimeType: "image/png", size: 1, uploadedBy: lars.id, isSampleData: true } });
    await deps.files.put(sampleFile.storageKey, new TextEncoder().encode("x"), sampleFile.mimeType);

    await clearSamples(db, deps.files);

    // keine Tabelle enthält danach noch Beispieldaten
    const tables = await db.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'isSampleData'`;
    for (const { table_name } of tables) {
      const [row] = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${table_name}" WHERE "isSampleData"`);
      expect([table_name, Number(row?.n)]).toEqual([table_name, 0]);
    }
    await expect(deps.files.get(sampleFile.storageKey)).rejects.toThrow();
    expect(await db.client.count({ where: { isInternal: false } })).toBe(0);
    expect(await db.clientMember.count()).toBe(0);
    expect(await db.user.count()).toBe(8);
    expect(await db.documentFormat.count()).toBe(13);
    expect(await db.shiftType.count()).toBe(3);
    expect((await db.user.findUniqueOrThrow({ where: { id: lars.id } })).selectedClientId).toBeNull();
    await seed(db);
  });
});

describe("Erster CVD für den Livegang (OPERATIONS.md)", () => {
  it("legt einen CVD mit Admin-Recht an oder hebt einen vorhandenen Nutzer an, protokolliert", async () => {
    const created = await bootstrapCvd(db, { name: "Erste Person", email: "Erste.Person@Example.org" });
    expect(created).toMatchObject({ email: "erste.person@example.org", role: "CVD", isAdmin: true, active: true });
    const laura = await db.user.findUniqueOrThrow({ where: { email: "laura@example.com" } });
    await db.user.update({ where: { id: laura.id }, data: { active: false } });
    const raised = await bootstrapCvd(db, { name: "Laura", email: "LAURA@example.com" });
    expect(raised).toMatchObject({ id: laura.id, role: "CVD", isAdmin: true, active: true });
    expect(await db.auditLog.count({ where: { entity: "User", entityId: { in: [created.id, laura.id] }, actorId: null } })).toBe(2);
    await expect(bootstrapCvd(db, { name: "", email: "keine-mail" })).rejects.toThrow();
  });
});
