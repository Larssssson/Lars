import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { listAudit } from "@/lib/domain/permissions/admin";
import { addDays, formatDateTime, startOfDay } from "@/lib/time";

const PERMISSION_LABELS: Record<string, string> = t.admin.grants.labels;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Werte eines Protokolleintrags lesbar machen (nur IDs und Rechte, keine Inhalte). */
function describe(value: unknown, names: Map<string, string>): string {
  if (!value || typeof value !== "object") return "";
  return Object.entries(value as Record<string, unknown>)
    .filter(([k]) => k !== "grantId")
    .map(([k, v]) => {
      const text = typeof v === "string" ? names.get(v) ?? PERMISSION_LABELS[v] ?? v : typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${k}: ${text}`;
    })
    .join(", ");
}

type Params = { bereich?: string; aktion?: string; q?: string; von?: string; bis?: string };

/** Protokoll (BRIEFING 7.10): durchsuchbar und filterbar, Einträge unveränderlich. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const entries = await listAudit(
    { db: prisma },
    {
      entity: p.bereich || null,
      action: p.aktion || null,
      q: p.q || null,
      from: p.von && DAY.test(p.von) ? startOfDay(p.von) : null,
      to: p.bis && DAY.test(p.bis) ? new Date(startOfDay(addDays(p.bis, 1)).getTime() - 1) : null,
    },
  );
  const [users, clients, contacts] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.client.findMany({ select: { id: true, name: true } }),
    prisma.journalist.findMany({ where: { id: { in: entries.flatMap((e) => (e.entity === "Journalist" && e.entityId ? [e.entityId] : [])) } }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  const names = new Map([...users, ...clients, ...contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))].map((x) => [x.id, x.name]));
  const a = t.admin.audit;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{a.intro}</p>
      <form key={JSON.stringify(p)} method="get" className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-5" aria-label={t.redaktion.filters.apply}>
        <Field label={a.search} htmlFor="audit-q"><Input id="audit-q" name="q" defaultValue={p.q ?? ""} /></Field>
        <Field label={a.subject} htmlFor="bereich">
          <Select id="bereich" name="bereich" defaultValue={p.bereich ?? ""}>
            <option value="">{a.filterAll}</option>
            <option value="User">{t.admin.tabs.users}</option>
            <option value="PermissionGrant">{t.admin.grants.title}</option>
            <option value="ClientMember">{t.admin.memberships.title}</option>
            <option value="Client">{t.clients.title}</option>
            <option value="Document">{t.admin.audit.areas.documents}</option>
            <option value="Journalist">{t.admin.audit.areas.contacts}</option>
            <option value="Setting">{t.admin.tabs.settings}</option>
          </Select>
        </Field>
        <Field label={a.actionFilter} htmlFor="aktion">
          <Select id="aktion" name="aktion" defaultValue={p.aktion ?? ""}>
            <option value="">{a.allActions}</option>
            {Object.entries(a.actions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={a.from} htmlFor="audit-von"><Input id="audit-von" name="von" type="date" defaultValue={p.von ?? ""} /></Field>
          <Field label={a.to} htmlFor="audit-bis"><Input id="audit-bis" name="bis" type="date" defaultValue={p.bis ?? ""} /></Field>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm">{t.redaktion.filters.apply}</Button>
          <Button asChild variant="ghost" size="sm"><Link href="/verwaltung/protokoll">{t.journo.filter.reset}</Link></Button>
        </div>
      </form>
      <p className="text-sm text-muted-foreground" data-testid="audit-count">{a.count(entries.length)}</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="audit">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">{a.at}</th>
              <th scope="col" className="px-3 py-2 font-medium">{a.actor}</th>
              <th scope="col" className="px-3 py-2 font-medium">{a.action}</th>
              <th scope="col" className="px-3 py-2 font-medium">{a.subject}</th>
              <th scope="col" className="px-3 py-2 font-medium">{a.details}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t align-top">
                <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(e.at)}</td>
                <td className="px-3 py-2">{e.actorId ? names.get(e.actorId) ?? e.actorId : a.system}</td>
                <td className="px-3 py-2">{a.actions[e.action] ?? e.action}</td>
                <td className="px-3 py-2">{e.entityId ? names.get(e.entityId) ?? e.entity : e.entity}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {e.before ? <span className="block">{describe(e.before, names)} →</span> : null}
                  {describe(e.after, names)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
