import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@/lib/db";
import { createClient, removeMembership, setClientLogo, setClientStatus, setMembership } from "@/lib/domain/clients/service";
import { setSelectedClient } from "@/lib/domain/clients/selection";
import { DomainError } from "@/lib/domain/errors";
import { ForbiddenError, hasApprovalRight } from "@/lib/domain/permissions";
import { metrics, recordActivity } from "@/lib/domain/metrics";
import { createPressReviewTasks } from "@/lib/domain/monitoring/actions";
import { createUser, grantPermission, listAudit, revokePermission, setUserActive, setUserRole } from "@/lib/domain/permissions/admin";
import { aiModelSettings, generalSettings, rpTemplateSettings, updateAiModels, updateGeneralSettings, updateRpTemplate } from "@/lib/domain/settings";
import { atTime } from "@/lib/time";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import { assignShift, copyWeek, cvdOnDuty, removeShift, weekView } from "@/lib/domain/shifts";
import { clientByName, FIXED_NOW, resetAndSeed, testDeps, userByKey, usersByKey, type TestDeps } from "./helpers";

const db = createPrismaClient();
let deps: TestDeps;

beforeEach(async () => {
  await resetAndSeed(db);
  deps = await testDeps(db);
});

describe("Nutzerverwaltung und Zusatzrechte (BRIEFING 3, 7.10)", () => {
  it("nur CVDs legen Nutzer an; die Mailadresse ist eindeutig", async () => {
    const [lars, laura] = await usersByKey(db, ["lars", "laura"]);
    await expect(createUser(deps, laura, { name: "Neu", email: "neu@example.com", role: "REDAKTEUR" })).rejects.toThrow(ForbiddenError);
    const user = await createUser(deps, lars, { name: "Neu", email: "Neu@Example.com", role: "REDAKTEUR" });
    expect(user.email).toBe("neu@example.com");
    await expect(createUser(deps, lars, { name: "Neu 2", email: "neu@example.com", role: "REDAKTEUR" })).rejects.toThrow(DomainError);
  });

  it("Freigaberecht pro Kunde vergeben und entziehen, protokolliert mit Vergeber", async () => {
    const [lars, laura] = await usersByKey(db, ["lars", "laura"]);
    const covenant = await clientByName(db, "Covenant");
    await expect(grantPermission(deps, lars, { userId: laura.id, permission: "APPROVE", clientId: null })).rejects.toThrow(DomainError);
    await grantPermission(deps, lars, { userId: laura.id, permission: "APPROVE", clientId: covenant.id });
    expect(hasApprovalRight(laura, await loadPermissionContext(db, laura.id), covenant.id)).toBe(true);
    const grant = await db.permissionGrant.findFirstOrThrow({ where: { userId: laura.id } });
    expect(grant.grantedById).toBe(lars.id);
    await revokePermission(deps, lars, grant.id);
    expect(hasApprovalRight(laura, await loadPermissionContext(db, laura.id), covenant.id)).toBe(false);
    const audit = await db.auditLog.findMany({ where: { entity: "PermissionGrant", entityId: laura.id }, orderBy: { at: "asc" } });
    expect(audit.map((a) => [a.action, a.actorId])).toEqual([["PERMISSION_GRANTED", lars.id], ["PERMISSION_REVOKED", lars.id]]);
  });

  it("Selbstfreigabe nie an sich selbst; Redakteure vergeben keine Rechte", async () => {
    const [lars, lukas, laura] = await usersByKey(db, ["lars", "lukas", "laura"]);
    await expect(grantPermission(deps, lars, { userId: lars.id, permission: "SELF_APPROVE", clientId: null })).rejects.toThrow(ForbiddenError);
    await grantPermission(deps, lars, { userId: lukas.id, permission: "SELF_APPROVE", clientId: null });
    await expect(grantPermission(deps, laura, { userId: laura.id, permission: "CREATE_TASKS_FOR_OTHERS", clientId: null })).rejects.toThrow(ForbiddenError);
  });

  it("Rolle ändern und Zugang sperren werden protokolliert, nie am eigenen Konto", async () => {
    const [lars, mika] = await usersByKey(db, ["lars", "mika"]);
    await setUserRole(deps, lars, mika.id, "CVD", false);
    await setUserActive(deps, lars, mika.id, false);
    expect((await db.user.findUniqueOrThrow({ where: { id: mika.id } })).active).toBe(false);
    await expect(setUserActive(deps, lars, lars.id, false)).rejects.toThrow(DomainError);
    await expect(setUserRole(deps, lars, lars.id, "REDAKTEUR", false)).rejects.toThrow(DomainError);
    const actions = (await db.auditLog.findMany({ where: { entityId: mika.id } })).map((a) => a.action).sort();
    expect(actions).toEqual(["USER_BLOCKED", "USER_ROLE_CHANGED"]);
  });

  it("Kundenzuordnungen setzen und entfernen, Freigaberecht nur für Leads", async () => {
    const [lars, hannah] = await usersByKey(db, ["lars", "hannah"]);
    const covenant = await clientByName(db, "Covenant");
    await setMembership(deps, lars, { clientId: covenant.id, userId: hannah.id, kind: "TEAM", canApprove: true });
    expect((await db.clientMember.findFirstOrThrow({ where: { userId: hannah.id, clientId: covenant.id } })).canApprove).toBe(false);
    await setMembership(deps, lars, { clientId: covenant.id, userId: hannah.id, kind: "LEAD", canApprove: true });
    expect(hasApprovalRight(hannah, await loadPermissionContext(db, hannah.id), covenant.id)).toBe(true);
    await removeMembership(deps, lars, covenant.id, hannah.id);
    expect(await db.clientMember.count({ where: { userId: hannah.id, clientId: covenant.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { entity: "ClientMember", entityId: hannah.id } })).toBe(3);
  });
});

describe("Kunden anlegen und archivieren (BRIEFING 6.8, 7.10)", () => {
  it("CVD legt Kunden im Onboarding mit Kunden-Lead an, Redakteure nicht", async () => {
    const [lars, laura, mika] = await usersByKey(db, ["lars", "laura", "mika"]);
    await expect(createClient(deps, laura, { name: "Neu", shortName: "Neu" })).rejects.toThrow(ForbiddenError);
    const client = await createClient(deps, lars, { name: "Capital.com", shortName: "Capital", cluster: "Finanzen" }, mika.id);
    expect(client.status).toBe("ONBOARDING");
    expect(client.aiAllowed).toBe(true);
    expect((await db.clientMember.findFirstOrThrow({ where: { clientId: client.id } })).kind).toBe("LEAD");
    await expect(createClient(deps, lars, { name: "X", shortName: "capital" })).rejects.toThrow(DomainError);
  });

  it("archivieren entfernt den Kunden aus der Auswahl, wiederherstellen führt ins Onboarding", async () => {
    const [lars, laura] = await usersByKey(db, ["lars", "laura"]);
    const rafael = await clientByName(db, "Rafael");
    await setSelectedClient(db, laura, rafael.id);
    await setClientStatus(deps, lars, rafael.id, "ARCHIVIERT");
    expect((await db.user.findUniqueOrThrow({ where: { id: laura.id } })).selectedClientId).toBeNull();
    await expect(setClientStatus(deps, lars, rafael.id, "AKTIV")).rejects.toThrow(DomainError);
    expect((await setClientStatus(deps, lars, rafael.id, "ONBOARDING")).status).toBe("ONBOARDING");
    expect(await db.auditLog.count({ where: { action: "CLIENT_STATUS_CHANGED", entityId: rafael.id } })).toBe(2);
  });

  it("Logo nur als PNG oder JPEG", async () => {
    const lars = await userByKey(db, "lars");
    const covenant = await clientByName(db, "Covenant");
    await expect(setClientLogo(deps, lars, covenant.id, { name: "x.pdf", mimeType: "application/pdf", data: new Uint8Array(4) })).rejects.toThrow(DomainError);
    await expect(setClientLogo(deps, lars, covenant.id, { name: "logo.svg", mimeType: "image/svg+xml", data: new TextEncoder().encode("<svg/>") })).rejects.toThrow(DomainError);
    await setClientLogo(deps, lars, covenant.id, { name: "logo.png", mimeType: "image/png", data: new Uint8Array(8) });
    expect((await clientByName(db, "Covenant")).logoFileId).not.toBeNull();
  });
});

describe("Dienstplan (BRIEFING 7.8, 13.6)", () => {
  it("Seed: CVD vom Dienst abwechselnd, Pressespiegel rotierend, zwei Wochen", async () => {
    const week = await weekView(db, "2026-10-20");
    const cvdRow = week.rows.find((r) => r.type.key === "CVD_VOM_DIENST")!;
    expect(cvdRow.cells.slice(0, 5).map((c) => c.entries[0]?.userName)).toEqual(["Lars Scholtyssyk", "Lukas", "Lars Scholtyssyk", "Lukas", "Lars Scholtyssyk"]);
    const ps = week.rows.find((r) => r.type.key === "PRESSESPIEGEL")!;
    expect(ps.cells.slice(0, 5).map((c) => c.entries[0]?.userName)).toEqual(["Laura", "Robin", "Mika", "Juliana", "Hannah"]);
    expect(cvdRow.cells[5]?.allowed).toBe(false);
    expect(await db.shift.count()).toBe(20);
    expect((await cvdOnDuty(db, FIXED_NOW))?.name).toBe("Lukas");
  });

  it("nur CVDs tragen ein; Dienste nur an ihren Wochentagen", async () => {
    const [lars, laura, hannah] = await usersByKey(db, ["lars", "laura", "hannah"]);
    const weekend = await db.shiftType.findUniqueOrThrow({ where: { key: "WOCHENENDE" } });
    await expect(assignShift(deps, laura, { shiftTypeId: weekend.id, day: "2026-10-24", userId: hannah.id })).rejects.toThrow(ForbiddenError);
    await expect(assignShift(deps, lars, { shiftTypeId: weekend.id, day: "2026-10-21", userId: hannah.id })).rejects.toThrow(DomainError);
    const shift = await assignShift(deps, lars, { shiftTypeId: weekend.id, day: "2026-10-24", userId: hannah.id });
    expect(shift.start.toISOString()).toBe("2026-10-24T07:00:00.000Z");
    await removeShift(deps, lars, shift.id);
    expect(await db.shift.count({ where: { shiftTypeId: weekend.id } })).toBe(0);
  });

  it("Woche kopieren übernimmt alle Dienste, ohne Dubletten", async () => {
    const lars = await userByKey(db, "lars");
    expect(await copyWeek(deps, lars, "2026-10-20", "2026-11-02")).toBe(10);
    expect(await copyWeek(deps, lars, "2026-10-20", "2026-11-02")).toBe(0);
    const copied = await weekView(db, "2026-11-02");
    expect(copied.rows.find((r) => r.type.key === "PRESSESPIEGEL")!.cells[0]?.entries[0]?.userName).toBe("Laura");
  });
});

describe("Einstellungen (BRIEFING 7.10)", () => {
  it("Standardwerte aus dem Briefing, Änderung durch CVD protokolliert, Prüfung der Werte", async () => {
    const [lars, laura] = await usersByKey(db, ["lars", "laura"]);
    expect(await generalSettings(db)).toEqual({ escalationFirstMinutes: 30, escalationSecondMinutes: 60, relevanceThreshold: 50, topArticles: 10 });
    await expect(updateGeneralSettings(deps, laura, { escalationFirstMinutes: 10, escalationSecondMinutes: 20, relevanceThreshold: 50, topArticles: 10 })).rejects.toThrow(ForbiddenError);
    await expect(updateGeneralSettings(deps, lars, { escalationFirstMinutes: 40, escalationSecondMinutes: 20, relevanceThreshold: 50, topArticles: 10 })).rejects.toThrow("später");
    await expect(updateGeneralSettings(deps, lars, { escalationFirstMinutes: 10, escalationSecondMinutes: 20, relevanceThreshold: 120, topArticles: 10 })).rejects.toThrow("zwischen 0 und 100");
    await updateGeneralSettings(deps, lars, { escalationFirstMinutes: "15", escalationSecondMinutes: "45", relevanceThreshold: "70", topArticles: "5" });
    expect(await generalSettings(db)).toEqual({ escalationFirstMinutes: 15, escalationSecondMinutes: 45, relevanceThreshold: 70, topArticles: 5 });
    expect(await db.auditLog.count({ where: { action: "SETTINGS_CHANGED", entityId: "general", actorId: lars.id } })).toBe(1);
  });

  it("RP-Vorlage mit Farbe, Schrift und Logo; Modellwahl nur für Admins", async () => {
    const [lars, laura, juliana] = await usersByKey(db, ["lars", "laura", "juliana"]);
    await expect(updateRpTemplate(deps, lars, { color: "blau", font: "Arial" })).rejects.toThrow("Hex");
    const png = await readFile(path.resolve("fixtures/templates/rp_logo_placeholder.png"));
    await updateRpTemplate(deps, lars, { color: "#0a6ebd", font: "TT Hoves Pro", logo: { name: "rp.png", mimeType: "image/png", data: new Uint8Array(png) } });
    const template = await rpTemplateSettings(db);
    expect(template).toMatchObject({ color: "0A6EBD", font: "TT Hoves Pro" });
    expect((await db.file.findUniqueOrThrow({ where: { id: template.logoFileId! } })).name).toBe("rp.png");
    await expect(updateAiModels(deps, laura, { quality: "claude-opus-5-5", fast: "" })).rejects.toThrow(ForbiddenError);
    await db.user.update({ where: { id: juliana.id }, data: { role: "CVD" } });
    await expect(updateAiModels(deps, { ...juliana, role: "CVD" }, { quality: "claude-opus-5-5", fast: "" })).rejects.toThrow(ForbiddenError);
    await expect(updateAiModels(deps, lars, { quality: "gpt-irgendwas", fast: "" })).rejects.toThrow("claude-");
    await updateAiModels(deps, lars, { quality: "claude-opus-5-5", fast: "" });
    expect(await aiModelSettings(db)).toEqual({ quality: "claude-opus-5-5" });
  });
});

describe("Kennzahlen (BRIEFING 7.10)", () => {
  it("aktive Nutzer pro Woche, Aufgaben pro Status, Freigabezeit, Push pro Person und Tag, verifizierte Kontakte, Pressespiegel-Dienste", async () => {
    const [lars, laura, mika] = await usersByKey(db, ["lars", "laura", "mika"]);
    await expect(metrics(deps, laura)).rejects.toThrow(ForbiddenError);
    await recordActivity(db, laura.id, FIXED_NOW);
    await recordActivity(db, laura.id, FIXED_NOW);
    await recordActivity(db, mika.id, FIXED_NOW);
    await recordActivity(db, mika.id, new Date(FIXED_NOW.getTime() - 7 * 86_400_000));
    await db.notification.createMany({ data: [
      { userId: laura.id, kind: "TASK_URGENT", title: "x", isPush: true, createdAt: FIXED_NOW },
      { userId: laura.id, kind: "TASK_URGENT", title: "y", isPush: true, createdAt: FIXED_NOW },
      { userId: laura.id, kind: "COMMENT", title: "z", isPush: false, createdAt: FIXED_NOW },
    ] });
    const m = await metrics(deps, lars);
    expect(m.activeUsersPerWeek).toHaveLength(8);
    expect(m.activeUsersPerWeek.at(-1)).toEqual({ week: "2026-10-19", users: 2 });
    expect(m.activeUsersPerWeek.at(-2)).toEqual({ week: "2026-10-12", users: 1 });
    expect(m.tasksByStatus.reduce((n, s) => n + s.count, 0)).toBe(await db.task.count());
    expect(m.pushPerPersonDay).toContainEqual({ name: "Laura", day: "2026-10-20", count: 2 });
    expect(m.verifiedContacts).toHaveLength(6);
    expect(m.verifiedContacts.at(-1)).toEqual({ month: "2026-10", count: await db.journalist.count({ where: { verifiedAt: { not: null } } }) });
    expect(m.approvalTime.count).toBe(await db.approval.count({ where: { decidedAt: { gte: new Date(FIXED_NOW.getTime() - 31 * 86_400_000) }, decision: { in: ["FREIGEGEBEN", "AENDERUNGEN"] } } }));

    // Pressespiegel-Dienst: Aufgabe aus dem Dienstplan, erledigt zählt
    deps.clock.now = atTime("2026-10-20", "07:05");
    await createPressReviewTasks(deps);
    const before = (await metrics(deps, lars)).reviewShifts;
    const shift = await db.shift.findFirstOrThrow({ where: { date: new Date("2026-10-20T00:00:00.000Z"), shiftType: { key: "PRESSESPIEGEL" } } });
    expect(shift.taskId).not.toBeNull();
    await db.task.update({ where: { id: shift.taskId! }, data: { status: "ERLEDIGT" } });
    const after = (await metrics(deps, lars)).reviewShifts;
    expect(after.total).toBe(before.total);
    expect(after.done).toBe(before.done + 1);
  });
});

describe("Protokoll durchsuchen und filtern (BRIEFING 7.10)", () => {
  it("nach Aktion, Person, Kunde, Zeitraum und Bezeichnung", async () => {
    const [lars, laura] = await usersByKey(db, ["lars", "laura"]);
    const covenant = await clientByName(db, "Covenant");
    await grantPermission(deps, lars, { userId: laura.id, permission: "APPROVE", clientId: covenant.id });
    await updateGeneralSettings(deps, lars, { escalationFirstMinutes: 10, escalationSecondMinutes: 20, relevanceThreshold: 50, topArticles: 10 });
    const granted = await listAudit(deps, { action: "PERMISSION_GRANTED" });
    expect(granted.length).toBeGreaterThan(0);
    expect(granted.every((e) => e.action === "PERMISSION_GRANTED")).toBe(true);
    expect((await listAudit(deps, { q: "Einstellung" })).every((e) => e.action === "SETTINGS_CHANGED")).toBe(true);
    expect((await listAudit(deps, { q: "laura" })).some((e) => e.action === "PERMISSION_GRANTED" && e.entityId === laura.id)).toBe(true);
    expect((await listAudit(deps, { q: "Lars Scholtyssyk" })).every((e) => e.actorId === lars.id || e.entityId === lars.id)).toBe(true);
    expect(await listAudit(deps, { from: new Date("2000-01-01"), to: new Date("2000-01-02") })).toEqual([]);
    expect((await listAudit(deps, { entity: "Setting" })).map((e) => e.entityId)).toEqual(["general"]);
  });
});
