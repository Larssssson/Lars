import { t } from "@/i18n";
import type { Deps } from "@/lib/domain/deps";
import { notify } from "@/lib/domain/notifications";
import type { PrismaClient } from "@/lib/generated/prisma/client";

/** Kontakte ohne Aktivität seit 24 Monaten (BRIEFING 7.5, 11). */
export const INACTIVE_MONTHS = 24;

/**
 * Liste der wöchentlichen Pflege: mögliche Dubletten (gleiche Mail, Telefonnummer oder Name plus
 * Medium) und Kontakte ohne Aktivität. Es wird nichts zusammengeführt oder gelöscht.
 */
export async function maintenanceList(db: PrismaClient, now: Date) {
  const contacts = await db.journalist.findMany({
    include: {
      contactDetails: { select: { kind: true, value: true } },
      media: { select: { name: true } },
      articles: { select: { publishedAt: true }, orderBy: { publishedAt: "desc" }, take: 1 },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const groups = new Map<string, { reason: "MAIL" | "TELEFON" | "NAME_MEDIUM"; ids: Set<string> }>();
  const add = (key: string, reason: "MAIL" | "TELEFON" | "NAME_MEDIUM", id: string) => {
    const group = groups.get(key) ?? { reason, ids: new Set<string>() };
    group.ids.add(id);
    groups.set(key, group);
  };
  for (const c of contacts) {
    for (const d of c.contactDetails) {
      if (d.kind === "MAIL") add(`MAIL:${d.value.toLowerCase()}`, "MAIL", c.id);
      if (d.kind === "TELEFON") add(`TELEFON:${d.value}`, "TELEFON", c.id);
    }
    if (c.media) add(`NAME:${c.firstName} ${c.lastName}|${c.media.name}`.toLowerCase(), "NAME_MEDIUM", c.id);
  }
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const seenPairs = new Set<string>();
  const duplicates = [...groups.values()]
    .filter((g) => g.ids.size > 1)
    .map((g) => ({ reason: g.reason, contacts: [...g.ids].map((id) => ({ id, name: `${byId.get(id)!.firstName} ${byId.get(id)!.lastName}`, media: byId.get(id)!.media?.name ?? null })) }))
    .filter((g) => {
      const key = g.contacts.map((c) => c.id).sort().join("|");
      if (seenPairs.has(key)) return false;
      seenPairs.add(key);
      return true;
    });

  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - INACTIVE_MONTHS);
  const inactive = contacts
    .filter((c) => c.lastActivityAt < cutoff && (!c.articles[0] || c.articles[0].publishedAt < cutoff))
    .map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, media: c.media?.name ?? null, lastActivityAt: c.lastActivityAt }));
  return { duplicates, inactive };
}

/** Job Montag 6 Uhr: den CVDs die Liste zur Durchsicht vorlegen, nur in der Glocke. */
export async function weeklyContactMaintenance(deps: Deps) {
  const list = await maintenanceList(deps.db, deps.now());
  if (!list.duplicates.length && !list.inactive.length) return list;
  const cvds = await deps.db.user.findMany({ where: { role: "CVD", active: true } });
  for (const cvd of cvds) {
    await notify(deps, {
      userId: cvd.id,
      kind: "CONTACT_MAINTENANCE",
      title: t.journo.maintenance.notification(list.duplicates.length, list.inactive.length),
      link: "/journo-hub/pflege",
      push: false,
    });
  }
  return list;
}
