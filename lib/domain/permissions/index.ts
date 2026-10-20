import type { MemberKind, Permission, Role, TaskStatus } from "@/lib/generated/prisma/enums";
import { ForbiddenError } from "./errors";

export { ForbiddenError };

/**
 * Rechteprüfung ausschließlich hier (BRIEFING 10.5). Jede Server Action und jeder
 * Route Handler ruft eine dieser Funktionen auf; die Oberfläche blendet nur aus.
 *
 * Rechte setzen sich aus drei Ebenen zusammen (BRIEFING 3): Grundrolle, Zuordnung pro
 * Kunde (Lead/Team, canApprove) und Zusatzrechte pro Person (PermissionGrant).
 * Die Funktionen sind rein; den Kontext lädt loadPermissionContext (context.ts).
 */
export type Actor = { id: string; role: Role; isAdmin: boolean; active: boolean };

/** Handelnder Nutzer mit Namen (für Benachrichtigungen und Änderungsmarkierungen). */
export type NamedActor = Actor & { name: string };

export type Membership = { clientId: string; kind: MemberKind; canApprove: boolean };

export type Grant = { permission: Permission; clientId: string | null; revokedAt: Date | null };

export type PermissionContext = { memberships: Membership[]; grants: Grant[] };

export const EMPTY_CONTEXT: PermissionContext = { memberships: [], grants: [] };

export function assert(allowed: boolean): asserts allowed {
  if (!allowed) throw new ForbiddenError();
}

export function isCvd(actor: Actor): boolean {
  return actor.active && actor.role === "CVD";
}

export function isLeadOf(ctx: PermissionContext, clientId: string): boolean {
  return ctx.memberships.some((m) => m.clientId === clientId && m.kind === "LEAD");
}

/** Aktives Zusatzrecht; ein Recht ohne Kunde gilt für alle Kunden. */
export function hasGrant(ctx: PermissionContext, permission: Permission, clientId?: string): boolean {
  return ctx.grants.some(
    (g) => g.permission === permission && g.revokedAt === null && (g.clientId === null || g.clientId === clientId),
  );
}

// ------------------------------------------------------------- Rechtematrix BRIEFING 3.3

/** Zeile 1: Eigene Aufgaben anlegen – alle. */
export function canCreateOwnTask(actor: Actor): boolean {
  return actor.active;
}

/** Zeile 2: Aufgaben für andere anlegen – CVD, Kunden-Lead für seinen Kunden, Zusatzrecht. */
export function canCreateTaskForOthers(actor: Actor, ctx: PermissionContext, clientId: string): boolean {
  if (!actor.active) return false;
  return isCvd(actor) || isLeadOf(ctx, clientId) || hasGrant(ctx, "CREATE_TASKS_FOR_OTHERS", clientId);
}

/** Aufgabe mit diesem Owner anlegen. */
export function canCreateTask(actor: Actor, ctx: PermissionContext, task: { clientId: string; ownerId: string }): boolean {
  return task.ownerId === actor.id ? canCreateOwnTask(actor) : canCreateTaskForOthers(actor, ctx, task.clientId);
}

/** Zeile 3: Priorität manuell hochstufen (und Markierung entfernen) – nur CVD. */
export function canEscalatePriority(actor: Actor): boolean {
  return isCvd(actor);
}

/**
 * Freigaberecht für einen Kunden (Zeile 4): CVD; Kunden-Lead, wenn der CVD es eingeschaltet hat
 * (ClientMember.canApprove); Zusatzrecht APPROVE für den Kunden (DECISIONS D-009).
 */
export function hasApprovalRight(actor: Actor, ctx: PermissionContext, clientId: string): boolean {
  if (!actor.active) return false;
  if (isCvd(actor)) return true;
  const leadWithRight = ctx.memberships.some((m) => m.clientId === clientId && m.kind === "LEAD" && m.canApprove);
  return leadWithRight || hasGrant(ctx, "APPROVE", clientId);
}

/**
 * Zeilen 4 und 5: Text freigeben. Den eigenen Text gibt niemand frei, auch kein CVD,
 * außer mit dem Zusatzrecht Selbstfreigabe (BRIEFING 3.3); diese Freigabe wird markiert.
 */
export function canApproveText(
  actor: Actor,
  ctx: PermissionContext,
  text: { clientId: string; ownerId: string },
): { allowed: boolean; isSelfApproval: boolean } {
  if (!hasApprovalRight(actor, ctx, text.clientId)) return { allowed: false, isSelfApproval: false };
  if (text.ownerId !== actor.id) return { allowed: true, isSelfApproval: false };
  const self = hasGrant(ctx, "SELF_APPROVE", text.clientId);
  return { allowed: self, isSelfApproval: self };
}

/** Zeile 6: Kundenprofil bearbeiten – CVD und Kunden-Lead; Redakteure machen Vorschläge. */
export function profileAccess(actor: Actor, ctx: PermissionContext, clientId: string): "EDIT" | "SUGGEST" | "NONE" {
  if (!actor.active) return "NONE";
  if (isCvd(actor) || isLeadOf(ctx, clientId)) return "EDIT";
  return "SUGGEST";
}

/**
 * Bearbeitungsrecht je Profilabschnitt (BRIEFING 7.7, DECISIONS D-010):
 * Stammdaten, KPIs, vereinbarte Leistungen und Kommunikationsziele nur CVD,
 * alle übrigen Abschnitte und die Kernbotschaften CVD und Kunden-Lead.
 */
export const CVD_ONLY_PROFILE_PARTS = ["stammdaten", "kpis", "vereinbarte_leistungen", "kommunikationsziele"] as const;

export function canEditProfilePart(actor: Actor, ctx: PermissionContext, clientId: string, part: string): boolean {
  if ((CVD_ONLY_PROFILE_PARTS as readonly string[]).includes(part)) return isCvd(actor);
  return profileAccess(actor, ctx, clientId) === "EDIT";
}

/** Zeile 7: Ziele, KPIs, vereinbarte Leistungen pflegen – nur CVD. */
export function canManageGoalsKpisServices(actor: Actor): boolean {
  return isCvd(actor);
}

/** Zeile 8: Kunden anlegen, archivieren (und Stammdaten ändern) – nur CVD. */
export function canManageClients(actor: Actor): boolean {
  return isCvd(actor);
}

/** Zeile 9: Kontakt anlegen, bearbeiten, verifizieren – alle. */
export function canEditContact(actor: Actor): boolean {
  return actor.active;
}

/** Zeile 10: Verifizierung entziehen, Kontakt löschen – nur CVD. */
export function canRevokeVerificationOrDeleteContact(actor: Actor): boolean {
  return isCvd(actor);
}

/**
 * Zeile 11: Telefonnummer und Mail sehen – Owner, nach Freigabe für den Kontext (DECISIONS D-012),
 * CVD immer. Jedes Aufdecken wird protokolliert, beim CVD ebenso.
 */
export function canRevealContactDetails(
  actor: Actor,
  contact: { isActiveOwner: boolean; hasAccessGrantForContext: boolean },
): boolean {
  if (!actor.active) return false;
  return isCvd(actor) || contact.isActiveOwner || contact.hasAccessGrantForContext;
}

/** Zeile 12: Pressespiegel importieren und bearbeiten – alle. */
export function canWorkOnMonitoring(actor: Actor): boolean {
  return actor.active;
}

/** Zeile 13: Dienstplan pflegen – nur CVD. */
export function canManageShifts(actor: Actor): boolean {
  return isCvd(actor);
}

/** Zeile 14: Nutzer anlegen, Rechte vergeben, Offboarding – nur CVD. */
export function canManageUsers(actor: Actor): boolean {
  return isCvd(actor);
}

/** Zusatzrecht vergeben: nur CVD; Selbstfreigabe nie an sich selbst (BRIEFING 3.3). */
export function canGrantPermission(actor: Actor, target: { userId: string; permission: Permission }): boolean {
  if (!canManageUsers(actor)) return false;
  return !(target.permission === "SELF_APPROVE" && target.userId === actor.id);
}

// ------------------------------------------------------------- weitere Rechte

/** Verwaltung öffnen: CVDs und Admins (BRIEFING 4). */
export function canOpenAdministration(actor: Actor): boolean {
  return actor.active && (actor.role === "CVD" || actor.isAdmin);
}

/** Technische Einstellungen (Integrationen, KI, Kennzahlen): nur Admin (BRIEFING 3.1). */
export function canManageTechnicalSettings(actor: Actor): boolean {
  return actor.active && actor.isAdmin;
}

/** Kundenauswahl in der Kopfzeile: jeder aktive Nutzer, alle Kunden sind sichtbar (BRIEFING 3.2). */
export function canSelectClient(actor: Actor): boolean {
  return actor.active;
}

/**
 * Aufgabe bearbeiten und Status ändern: Owner, CVD und Kunden-Lead des Kunden
 * (DECISIONS D-044). Wer den Owner ändert, braucht zusätzlich das Recht für den neuen Owner.
 */
export function canEditTask(actor: Actor, ctx: PermissionContext, task: { clientId: string; ownerId: string }): boolean {
  if (!actor.active) return false;
  return task.ownerId === actor.id || isCvd(actor) || isLeadOf(ctx, task.clientId);
}

/** Team-Ansicht auf dem Dashboard: nur CVD (BRIEFING 7.1). */
export function canSeeTeamView(actor: Actor): boolean {
  return isCvd(actor);
}

/** Warnungen auf dem Dashboard: CVDs für alle Kunden, Kunden-Leads für ihre Kunden (BRIEFING 7.1). */
export function canSeeClientWarnings(actor: Actor, ctx: PermissionContext, clientId: string): boolean {
  return isCvd(actor) || (actor.active && isLeadOf(ctx, clientId));
}

// ------------------------------------------------------------- Dokumente (BRIEFING 6.3, 6.4)

/** Status, in denen der Owner (und wer die Aufgabe bearbeiten darf) schreiben kann. */
export const WRITABLE_STATUSES: TaskStatus[] = ["OFFEN", "IN_BEARBEITUNG", "AENDERUNGEN_ANGEFORDERT"];

/**
 * Wer darf im Text schreiben? In Bearbeitung: wer die Aufgabe bearbeiten darf (D-044).
 * Freigabe angefragt: nur der Freigeber, der die Prüfung übernommen hat (D-018).
 * Freigegeben, beim Kunden, erledigt: niemand; ändern heißt erst zurücksetzen (BRIEFING 6.3).
 */
export function canEditDocument(
  actor: Actor,
  ctx: PermissionContext,
  doc: { clientId: string; ownerId: string; status: TaskStatus; claimedBy: string | null },
): boolean {
  if (!actor.active) return false;
  if (WRITABLE_STATUSES.includes(doc.status)) return canEditTask(actor, ctx, doc);
  if (doc.status === "FREIGABE_ANGEFRAGT") return doc.claimedBy === actor.id && hasApprovalRight(actor, ctx, doc.clientId);
  return false;
}

/** Änderungsverfolgung ist an, wenn eingeschaltet oder jemand anderes als der Owner schreibt (BRIEFING 7.3). */
export function mustTrackChanges(actor: Actor, doc: { ownerId: string; trackChangesOn: boolean }): boolean {
  return doc.trackChangesOn || actor.id !== doc.ownerId;
}

/** Freigabe anfragen und zurückziehen: der Owner (BRIEFING 6.4). */
export function canRequestApproval(actor: Actor, task: { ownerId: string }): boolean {
  return actor.active && actor.id === task.ownerId;
}
