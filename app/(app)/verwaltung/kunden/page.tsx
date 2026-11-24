import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { canDeleteRecords, canManageClients } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";

/** Kunden in der Verwaltung: anlegen, öffnen, löschen (Löschen auf der Kundenseite, nur Admin; DECISIONS D-126). */
export default async function AdminClientsPage() {
  const user = await requireUser();
  const clients = await prisma.client.findMany({
    where: { isInternal: false },
    include: { _count: { select: { tasks: true } } },
    orderBy: { name: "asc" },
  });
  const c = t.clients;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{canDeleteRecords(user) ? t.admin.clients.introAdmin : t.admin.clients.intro}</p>
        {canManageClients(user) && <Button asChild size="sm"><Link href="/kunden/neu">{c.newClient}</Link></Button>}
      </div>
      {clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.admin.clients.none}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{c.fields.name}</th>
                <th scope="col" className="px-3 py-2 font-medium">{c.fields.status}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t.admin.clients.tasks}</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-t">
                  <td className="px-3 py-2"><Link href={`/kunden/${client.id}`} className="font-medium hover:underline">{client.name}</Link></td>
                  <td className="px-3 py-2"><Badge>{t.common.clientStatus[client.status]}</Badge></td>
                  <td className="px-3 py-2">{client._count.tasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
