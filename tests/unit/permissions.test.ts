import { describe, expect, it } from "vitest";
import {
  canApproveText,
  canCreateOwnTask,
  canCreateTask,
  canCreateTaskForOthers,
  canEditContact,
  canEditProfilePart,
  canEditTask,
  canEscalatePriority,
  canGrantPermission,
  canManageClients,
  canManageGoalsKpisServices,
  canManageShifts,
  canManageTechnicalSettings,
  canManageUsers,
  canOpenAdministration,
  canRevealContactDetails,
  canRevokeVerificationOrDeleteContact,
  canSeeClientWarnings,
  canSeeTeamView,
  canWorkOnMonitoring,
  EMPTY_CONTEXT,
  hasApprovalRight,
  profileAccess,
  type Actor,
  type PermissionContext,
} from "@/lib/domain/permissions";

const CLIENT = "client-a";
const OTHER_CLIENT = "client-b";

const redakteur: Actor = { id: "r", role: "REDAKTEUR", isAdmin: false, active: true };
const lead: Actor = { id: "l", role: "REDAKTEUR", isAdmin: false, active: true };
const cvd: Actor = { id: "c", role: "CVD", isAdmin: false, active: true };
const leadCtx: PermissionContext = { memberships: [{ clientId: CLIENT, kind: "LEAD", canApprove: false }], grants: [] };
const leadWithApproval: PermissionContext = { memberships: [{ clientId: CLIENT, kind: "LEAD", canApprove: true }], grants: [] };
const teamCtx: PermissionContext = { memberships: [{ clientId: CLIENT, kind: "TEAM", canApprove: false }], grants: [] };

/** Spalten der Matrix: Redakteur, Kunden-Lead (für seinen Kunden), CVD */
const columns = [
  { name: "Redakteur", actor: redakteur, ctx: teamCtx },
  { name: "Kunden-Lead", actor: lead, ctx: leadCtx },
  { name: "CVD", actor: cvd, ctx: EMPTY_CONTEXT },
] as const;

function row(check: (actor: Actor, ctx: PermissionContext) => boolean): boolean[] {
  return columns.map((c) => check(c.actor, c.ctx));
}

describe("Rechtematrix BRIEFING 3.3", () => {
  it("Eigene Aufgaben anlegen: ja, ja, ja", () => {
    expect(row((a) => canCreateOwnTask(a))).toEqual([true, true, true]);
    expect(row((a, ctx) => canCreateTask(a, ctx, { clientId: CLIENT, ownerId: a.id }))).toEqual([true, true, true]);
  });

  it("Aufgaben für andere anlegen: nein, ja (eigener Kunde), ja", () => {
    expect(row((a, ctx) => canCreateTaskForOthers(a, ctx, CLIENT))).toEqual([false, true, true]);
    expect(row((a, ctx) => canCreateTask(a, ctx, { clientId: CLIENT, ownerId: "jemand" }))).toEqual([false, true, true]);
    // Kunden-Lead nur für seinen Kunden
    expect(canCreateTaskForOthers(lead, leadCtx, OTHER_CLIENT)).toBe(false);
  });

  it("Priorität manuell hochstufen: nein, nein, ja", () => {
    expect(row((a) => canEscalatePriority(a))).toEqual([false, false, true]);
  });

  it("Texte freigeben: nein, wenn vom CVD eingeschaltet, ja", () => {
    const text = { clientId: CLIENT, ownerId: "autor" };
    expect(row((a, ctx) => canApproveText(a, ctx, text).allowed)).toEqual([false, false, true]);
    expect(canApproveText(lead, leadWithApproval, text).allowed).toBe(true);
    expect(canApproveText(lead, leadWithApproval, { clientId: OTHER_CLIENT, ownerId: "autor" }).allowed).toBe(false);
  });

  it("Eigene Texte freigeben: nein, nein, nein", () => {
    expect(row((a, ctx) => canApproveText(a, ctx, { clientId: CLIENT, ownerId: a.id }).allowed)).toEqual([false, false, false]);
    expect(canApproveText(lead, leadWithApproval, { clientId: CLIENT, ownerId: lead.id }).allowed).toBe(false);
  });

  it("Kundenprofil bearbeiten: Vorschläge machen, ja, ja", () => {
    expect(columns.map((c) => profileAccess(c.actor, c.ctx, CLIENT))).toEqual(["SUGGEST", "EDIT", "EDIT"]);
    expect(row((a, ctx) => canEditProfilePart(a, ctx, CLIENT, "kernbotschaften"))).toEqual([false, true, true]);
    expect(profileAccess(lead, leadCtx, OTHER_CLIENT)).toBe("SUGGEST");
  });

  it("Ziele, KPIs, vereinbarte Leistungen pflegen: nein, nein, ja", () => {
    expect(row((a) => canManageGoalsKpisServices(a))).toEqual([false, false, true]);
    for (const part of ["kommunikationsziele", "kpis", "vereinbarte_leistungen", "stammdaten"]) {
      expect(row((a, ctx) => canEditProfilePart(a, ctx, CLIENT, part))).toEqual([false, false, true]);
    }
  });

  it("Kunden anlegen, archivieren: nein, nein, ja", () => {
    expect(row((a) => canManageClients(a))).toEqual([false, false, true]);
  });

  it("Kontakt anlegen, bearbeiten, verifizieren: ja, ja, ja", () => {
    expect(row((a) => canEditContact(a))).toEqual([true, true, true]);
  });

  it("Verifizierung entziehen, Kontakt löschen: nein, nein, ja", () => {
    expect(row((a) => canRevokeVerificationOrDeleteContact(a))).toEqual([false, false, true]);
  });

  it("Telefonnummer und Mail sehen: als Owner oder nach Freigabe, als Owner oder nach Freigabe, ja", () => {
    const none = { isActiveOwner: false, hasAccessGrantForContext: false };
    expect(row((a) => canRevealContactDetails(a, none))).toEqual([false, false, true]);
    expect(row((a) => canRevealContactDetails(a, { ...none, isActiveOwner: true }))).toEqual([true, true, true]);
    expect(row((a) => canRevealContactDetails(a, { ...none, hasAccessGrantForContext: true }))).toEqual([true, true, true]);
  });

  it("Pressespiegel importieren und bearbeiten: ja, ja, ja", () => {
    expect(row((a) => canWorkOnMonitoring(a))).toEqual([true, true, true]);
  });

  it("Dienstplan pflegen: nein, nein, ja", () => {
    expect(row((a) => canManageShifts(a))).toEqual([false, false, true]);
  });

  it("Nutzer anlegen, Rechte vergeben, Offboarding: nein, nein, ja", () => {
    expect(row((a) => canManageUsers(a))).toEqual([false, false, true]);
    expect(row((a) => canGrantPermission(a, { userId: "x", permission: "APPROVE" }))).toEqual([false, false, true]);
  });
});

describe("Zusatzrechte pro Person (BRIEFING 3.3)", () => {
  it("Freigaberecht für einzelne Kunden", () => {
    const ctx: PermissionContext = { memberships: [], grants: [{ permission: "APPROVE", clientId: CLIENT, revokedAt: null }] };
    expect(hasApprovalRight(redakteur, ctx, CLIENT)).toBe(true);
    expect(hasApprovalRight(redakteur, ctx, OTHER_CLIENT)).toBe(false);
  });

  it("entzogene Rechte gelten nicht mehr", () => {
    const ctx: PermissionContext = { memberships: [], grants: [{ permission: "APPROVE", clientId: CLIENT, revokedAt: new Date() }] };
    expect(hasApprovalRight(redakteur, ctx, CLIENT)).toBe(false);
  });

  it("Aufgaben für andere anlegen, auch ohne Kundenbezug für alle Kunden", () => {
    const ctx: PermissionContext = { memberships: [], grants: [{ permission: "CREATE_TASKS_FOR_OTHERS", clientId: null, revokedAt: null }] };
    expect(canCreateTaskForOthers(redakteur, ctx, CLIENT)).toBe(true);
    expect(canCreateTaskForOthers(redakteur, ctx, OTHER_CLIENT)).toBe(true);
  });

  it("Selbstfreigabe erlaubt den eigenen Text und wird markiert", () => {
    const ctx: PermissionContext = { memberships: [], grants: [{ permission: "SELF_APPROVE", clientId: null, revokedAt: null }] };
    expect(canApproveText(cvd, ctx, { clientId: CLIENT, ownerId: cvd.id })).toEqual({ allowed: true, isSelfApproval: true });
    // Selbstfreigabe allein ersetzt kein Freigaberecht
    expect(canApproveText(redakteur, ctx, { clientId: CLIENT, ownerId: redakteur.id }).allowed).toBe(false);
  });

  it("Selbstfreigabe kann ein CVD nicht an sich selbst vergeben", () => {
    expect(canGrantPermission(cvd, { userId: cvd.id, permission: "SELF_APPROVE" })).toBe(false);
    expect(canGrantPermission(cvd, { userId: "anderer-cvd", permission: "SELF_APPROVE" })).toBe(true);
    expect(canGrantPermission(cvd, { userId: cvd.id, permission: "APPROVE" })).toBe(true);
  });
});

describe("Weitere Rechte", () => {
  it("Verwaltung: CVD oder Admin; technische Einstellungen nur Admin", () => {
    const admin: Actor = { ...redakteur, isAdmin: true };
    expect([redakteur, admin, cvd].map(canOpenAdministration)).toEqual([false, true, true]);
    expect([redakteur, admin, cvd].map(canManageTechnicalSettings)).toEqual([false, true, false]);
  });

  it("Aufgabe bearbeiten: Owner, Kunden-Lead des Kunden, CVD (DECISIONS D-044)", () => {
    const task = { clientId: CLIENT, ownerId: "jemand" };
    expect(row((a, ctx) => canEditTask(a, ctx, task))).toEqual([false, true, true]);
    expect(canEditTask(redakteur, teamCtx, { clientId: CLIENT, ownerId: redakteur.id })).toBe(true);
  });

  it("Team-Ansicht nur CVD, Warnungen für CVD und Lead des Kunden", () => {
    expect(row((a) => canSeeTeamView(a))).toEqual([false, false, true]);
    expect(row((a, ctx) => canSeeClientWarnings(a, ctx, CLIENT))).toEqual([false, true, true]);
  });

  it("gesperrte Nutzer haben kein Recht", () => {
    const blocked: Actor = { ...cvd, active: false };
    expect(canCreateOwnTask(blocked)).toBe(false);
    expect(canEscalatePriority(blocked)).toBe(false);
    expect(canManageUsers(blocked)).toBe(false);
    expect(canRevealContactDetails(blocked, { isActiveOwner: true, hasAccessGrantForContext: true })).toBe(false);
  });
});
