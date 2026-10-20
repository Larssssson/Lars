import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { listAudit } from "@/lib/domain/permissions/admin";
import { formatDateTime } from "@/lib/time";

const PERMISSION_LABELS: Record<string, string> = t.admin.grants.labels;

/** Werte eines Protokolleintrags lesbar machen (nur IDs und Rechte, keine Inhalte). */
function describe(value: unknown, names: Map<string, string>): string {
  if (!value || typeof value !== "object") return "";
  return Object.entries(value as Record<string, unknown>)
    .filter(([k]) => k !== "grantId")
    .map(([k, v]) => {
      const text = typeof v === "string" ? names.get(v) ?? PERMISSION_LABELS[v] ?? v : String(v);
      return `${k}: ${text}`;
    })
    .join(", ");
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ bereich?: string }> }) {
  const { bereich } = await searchParams;
  const entries = await listAudit({ db: prisma }, { entity: bereich || null });
  const [users, clients] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.client.findMany({ select: { id: true, name: true } }),
  ]);
  const names = new Map([...users, ...clients].map((x) => [x.id, x.name]));
  const a = t.admin.audit;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{a.intro}</p>
      <form method="get" className="flex items-end gap-2">
        <label htmlFor="bereich" className="sr-only">{a.subject}</label>
        <select id="bereich" name="bereich" defaultValue={bereich ?? ""} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">{a.filterAll}</option>
          <option value="User">{t.admin.tabs.users}</option>
          <option value="PermissionGrant">{t.admin.grants.title}</option>
          <option value="ClientMember">{t.admin.memberships.title}</option>
          <option value="Client">{t.clients.title}</option>
        </select>
        <button type="submit" className="h-9 rounded-md border px-3 text-sm hover:bg-accent">{t.redaktion.filters.apply}</button>
      </form>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
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
