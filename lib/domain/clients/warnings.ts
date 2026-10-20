import type { PrismaClient } from "@/lib/generated/prisma/client";
import { t } from "@/i18n";
import { canSeeClientWarnings, type Actor, type PermissionContext } from "@/lib/domain/permissions";
import { COMPLIANCE_STALE_DAYS, PROFILE_STALE_DAYS } from "./profile-sections";
import { servicesWithProgress } from "./services";

export type ClientWarning = {
  kind: "PROFILE_STALE" | "COMPLIANCE_STALE" | "OPEN_SUGGESTIONS" | "SERVICE_BEHIND";
  severity: "WARNUNG" | "ROT";
  clientId: string;
  clientName: string;
  text: string;
  link: string;
};

const DAY = 86_400_000;

/** Warnungen eines Kunden (BRIEFING 7.1, 7.7); nur für aktive Kunden. */
export async function warningsForClient(
  db: PrismaClient,
  client: { id: string; name: string },
  now: Date,
): Promise<ClientWarning[]> {
  const warnings: ClientWarning[] = [];
  const link = `/kunden/${client.id}`;
  const base = { clientId: client.id, clientName: client.name, link };
  const sections = await db.clientProfileSection.findMany({ where: { clientId: client.id } });

  const stale = sections.filter((s) => !s.confirmedAt || now.getTime() - s.confirmedAt.getTime() > PROFILE_STALE_DAYS * DAY);
  if (stale.length > 0) {
    warnings.push({ ...base, kind: "PROFILE_STALE", severity: "WARNUNG", text: t.warnings.profileStale(stale.length, PROFILE_STALE_DAYS) });
  }
  const compliance = sections.find((s) => s.key === "compliance");
  if (compliance?.confirmedAt && now.getTime() - compliance.confirmedAt.getTime() > COMPLIANCE_STALE_DAYS * DAY) {
    const months = Math.floor((now.getTime() - compliance.confirmedAt.getTime()) / (30.44 * DAY));
    warnings.push({ ...base, kind: "COMPLIANCE_STALE", severity: "ROT", text: t.warnings.complianceStale(months) });
  }

  const suggestions = await db.profileSuggestion.count({ where: { clientId: client.id, status: "OFFEN" } });
  if (suggestions > 0) warnings.push({ ...base, kind: "OPEN_SUGGESTIONS", severity: "WARNUNG", text: t.warnings.openSuggestions(suggestions) });

  for (const service of await servicesWithProgress(db, client.id, now)) {
    if (!service.behind) continue;
    warnings.push({
      ...base,
      kind: "SERVICE_BEHIND",
      severity: "WARNUNG",
      text: t.warnings.serviceBehind(service.title, service.done, service.targetCount, service.period, service.weeksLeft),
    });
  }
  return warnings;
}

/** Warnungen für das Dashboard: CVD alle aktiven Kunden, Kunden-Lead seine Kunden. */
export async function warningsFor(
  db: PrismaClient,
  actor: Actor,
  ctx: PermissionContext,
  clientId: string | null,
  now: Date,
): Promise<ClientWarning[]> {
  const clients = await db.client.findMany({
    where: { status: "AKTIV", id: clientId ?? undefined },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const visible = clients.filter((c) => canSeeClientWarnings(actor, ctx, c.id));
  return (await Promise.all(visible.map((c) => warningsForClient(db, c, now)))).flat();
}
