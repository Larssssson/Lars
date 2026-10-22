import Link from "next/link";
import { NewUserForm } from "@/components/admin/admin-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { canManageUsers } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";

export default async function UsersPage() {
  const user = await requireUser();
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      clientMembers: { include: { client: { select: { name: true } } } },
      permissionGrants: { where: { revokedAt: null } },
    },
  });
  const u = t.admin.users;
  return (
    <div className="flex flex-col gap-5">
      {canManageUsers(user) && (
        <Card>
          <CardTitle className="mb-3">{u.newUser}</CardTitle>
          <NewUserForm />
        </Card>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">{u.name}</th>
              <th scope="col" className="px-3 py-2 font-medium">{u.role}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t.admin.memberships.title}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t.admin.grants.title}</th>
              <th scope="col" className="px-3 py-2 font-medium">{u.status}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">
                  <Link href={`/verwaltung/nutzer/${row.id}`} className="font-medium hover:underline">{row.name}</Link>
                  <span className="block text-xs text-muted-foreground">{row.email}</span>
                </td>
                <td className="px-3 py-2">{t.common.roles[row.role]}{row.isAdmin ? ` · ${t.common.admin}` : ""}</td>
                <td className="px-3 py-2">
                  {row.clientMembers.map((m) => `${m.client.name} (${t.common.memberKind[m.kind]})`).join(", ") || "–"}
                </td>
                <td className="px-3 py-2">{row.permissionGrants.length || "–"}</td>
                <td className="px-3 py-2"><Badge>{row.active ? u.active : u.blocked}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
