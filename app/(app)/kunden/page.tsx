import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { canManageClients } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ archiviert?: string }> }) {
  const user = await requireUser();
  const { archiviert } = await searchParams;
  const showArchived = archiviert === "1";
  const clients = await prisma.client.findMany({
    where: showArchived ? {} : { status: { not: "ARCHIVIERT" } },
    include: { members: { include: { user: { select: { name: true } } } } },
    orderBy: { name: "asc" },
  });
  const c = t.clients;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={showArchived ? "/kunden" : "/kunden?archiviert=1"}>{showArchived ? c.hideArchived : c.showArchived}</Link>
          </Button>
          {canManageClients(user) && <Button asChild size="sm"><Link href="/kunden/neu">{c.newClient}</Link></Button>}
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">{c.fields.name}</th>
              <th scope="col" className="px-3 py-2 font-medium">{c.fields.cluster}</th>
              <th scope="col" className="px-3 py-2 font-medium">{c.fields.status}</th>
              <th scope="col" className="px-3 py-2 font-medium">{c.fields.lead}</th>
              <th scope="col" className="px-3 py-2 font-medium">{c.fields.team}</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-t">
                <td className="px-3 py-2"><Link href={`/kunden/${client.id}`} className="font-medium hover:underline">{client.name}</Link></td>
                <td className="px-3 py-2">{client.cluster ?? "–"}</td>
                <td className="px-3 py-2"><Badge>{t.common.clientStatus[client.status]}</Badge></td>
                <td className="px-3 py-2">{client.members.filter((m) => m.kind === "LEAD").map((m) => m.user.name).join(", ") || "–"}</td>
                <td className="px-3 py-2">{client.members.filter((m) => m.kind === "TEAM").map((m) => m.user.name).join(", ") || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
