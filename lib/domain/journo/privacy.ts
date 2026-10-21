import { t } from "@/i18n";
import { AuditAction, writeAudit } from "@/lib/domain/audit";
import type { Deps } from "@/lib/domain/deps";
import { renderPdf } from "@/lib/domain/documents/pdf";
import { assert, canRevokeVerificationOrDeleteContact, type Actor } from "@/lib/domain/permissions";
import { formatDate, formatDateTime } from "@/lib/time";
import { requireContact } from "./contacts";

/**
 * Auskunft (BRIEFING 11): alle gespeicherten Daten eines Kontakts als JSON und PDF, nur CVD.
 * Die Erstellung steht ohne Inhalte im Protokoll.
 */
export async function exportContactData(deps: Deps, actor: Actor, journalistId: string) {
  assert(canRevokeVerificationOrDeleteContact(actor));
  await requireContact(deps.db, journalistId);
  const c = await deps.db.journalist.findUniqueOrThrow({
    where: { id: journalistId },
    include: {
      media: { select: { name: true, type: true } },
      contactDetails: true,
      owners: { include: { user: { select: { name: true } } } },
      requests: { include: { client: { select: { name: true } } } },
      accessGrants: { include: { client: { select: { name: true } } } },
      revealLogs: true,
      articles: { select: { headline: true, mediaName: true, publishedAt: true, url: true } },
      bookmarks: { select: { createdAt: true } },
    },
  });
  const ids = [...new Set([c.createdBy, c.verifiedBy, c.updatedBy, ...c.revealLogs.map((r) => r.userId), ...c.requests.map((r) => r.requesterId), ...c.accessGrants.map((g) => g.userId)].filter((x): x is string => Boolean(x)))];
  const users = new Map((await deps.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const user = (id: string | null) => (id ? (users.get(id) ?? id) : null);
  const data = {
    exportedAt: deps.now().toISOString(),
    person: { firstName: c.firstName, lastName: c.lastName, function: c.function, desk: c.desk, topics: c.topics, region: c.region, notes: c.notes },
    media: c.media,
    status: c.status,
    source: c.source,
    firstContactAt: c.firstContactAt?.toISOString() ?? null,
    lastActivityAt: c.lastActivityAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
    createdBy: user(c.createdBy),
    verifiedAt: c.verifiedAt?.toISOString() ?? null,
    verifiedBy: user(c.verifiedBy),
    contactDetails: c.contactDetails.map((d) => ({ kind: d.kind, value: d.value, isPrimary: d.isPrimary })),
    owners: c.owners.map((o) => ({ name: o.user.name, since: o.since.toISOString(), active: o.active, relationNote: o.relationNote, relationQuality: o.relationQuality })),
    requests: c.requests.map((r) => ({ client: r.client.name, requester: user(r.requesterId), status: r.status, createdAt: r.createdAt.toISOString() })),
    accessGrants: c.accessGrants.map((g) => ({ client: g.client.name, user: user(g.userId), createdAt: g.createdAt.toISOString() })),
    reveals: c.revealLogs.map((r) => ({ user: user(r.userId), kind: r.kind, at: r.at.toISOString() })),
    articles: c.articles.map((a) => ({ headline: a.headline, media: a.mediaName, publishedAt: a.publishedAt.toISOString(), url: a.url })),
    bookmarks: c.bookmarks.length,
  };
  await writeAudit(deps.db, { actorId: actor.id, action: AuditAction.CONTACT_EXPORTED, entity: "Journalist", entityId: journalistId });
  return data;
}

type ExportData = Awaited<ReturnType<typeof exportContactData>>;

const esc = (v: unknown) => String(v ?? "–").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

/** Dieselbe Auskunft als PDF (HTML-Vorlage, gerendert mit Chromium). */
export async function exportContactPdf(data: ExportData): Promise<Uint8Array> {
  const p = t.journo.privacyPdf;
  const date = (iso: string | null) => (iso ? formatDate(new Date(iso)) : "–");
  const rows = (items: string[][]) => items.map((cells) => `<tr>${cells.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("");
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;font-size:10pt;margin:0}h1{font-size:16pt}h2{font-size:12pt;margin-top:16pt}
    table{border-collapse:collapse;width:100%}td{border:1px solid #ccc;padding:3pt;vertical-align:top}</style></head><body>
    <h1>${esc(p.title(`${data.person.firstName} ${data.person.lastName}`))}</h1>
    <p>${esc(p.exportedAt(formatDateTime(new Date(data.exportedAt))))}</p>
    <h2>${esc(p.person)}</h2><table>${rows([
      [p.fields.function, data.person.function ?? "–"],
      [p.fields.desk, data.person.desk ?? "–"],
      [p.fields.media, data.media?.name ?? "–"],
      [p.fields.topics, data.person.topics.join(", ") || "–"],
      [p.fields.region, data.person.region ?? "–"],
      [p.fields.notes, data.person.notes ?? "–"],
      [p.fields.status, t.journo.statuses[data.status] ?? data.status],
      [p.fields.firstContact, date(data.firstContactAt)],
      [p.fields.created, `${date(data.createdAt)} ${data.createdBy ?? ""}`],
      [p.fields.verified, data.verifiedAt ? `${date(data.verifiedAt)} ${data.verifiedBy ?? ""}` : "–"],
    ])}</table>
    <h2>${esc(p.details)}</h2><table>${rows(data.contactDetails.map((d) => [t.journo.kinds[d.kind] ?? d.kind, d.value]))}</table>
    <h2>${esc(p.owners)}</h2><table>${rows(data.owners.map((o) => [o.name, date(o.since), o.active ? "" : t.journo.inactiveOwner]))}</table>
    <h2>${esc(p.requests)}</h2><table>${rows(data.requests.map((r) => [r.client, r.requester ?? "", t.journo.request.statuses[r.status] ?? r.status, date(r.createdAt)]))}</table>
    <h2>${esc(p.reveals)}</h2><table>${rows(data.reveals.map((r) => [r.user ?? "", t.journo.kinds[r.kind] ?? r.kind, formatDateTime(new Date(r.at))]))}</table>
    <h2>${esc(p.articles)}</h2><table>${rows(data.articles.map((a) => [date(a.publishedAt), a.media, a.headline]))}</table>
    </body></html>`;
  return renderPdf(html);
}

/**
 * Endgültig löschen (BRIEFING 11): Kontakt mit Kontaktdaten, Ownern, Anfragen, Freigaben und
 * Vormerkungen; Artikel bleiben ohne Zuordnung. Das Protokoll nennt nur die ID.
 */
export async function deleteContact(deps: Deps, actor: Actor, journalistId: string) {
  assert(canRevokeVerificationOrDeleteContact(actor));
  await requireContact(deps.db, journalistId);
  await deps.db.$transaction(async (tx) => {
    await tx.article.updateMany({ where: { journalistId }, data: { journalistId: null } });
    await tx.articleAction.updateMany({ where: { resultJournalistId: journalistId }, data: { resultJournalistId: null } });
    await tx.journalist.delete({ where: { id: journalistId } });
  });
  await writeAudit(deps.db, { actorId: actor.id, action: AuditAction.CONTACT_DELETED, entity: "Journalist", entityId: journalistId });
}
