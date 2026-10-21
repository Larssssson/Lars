import Link from "next/link";
import { notFound } from "next/navigation";
import { ActiveToggle, GrantForm, RevokeGrantButton, RoleForm } from "@/components/admin/admin-forms";
import { MembershipForm, RemoveMembershipButton } from "@/components/clients/client-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { canGrantPermission, canManageUsers } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/time";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireUser();
  const user = await prisma.user
    .findUnique({
      where: { id },
      include: {
        clientMembers: { include: { client: { select: { id: true, name: true } } } },
        permissionGrants: { where: { revokedAt: null }, include: { client: { select: { name: true } }, grantedBy: { select: { name: true } } }, orderBy: { grantedAt: "desc" } },
      },
    })
    .catch(() => null);
  if (!user) notFound();
  const manage = canManageUsers(actor);
  const self = actor.id === user.id;
  const clients = await prisma.client.findMany({ where: { status: { not: "ARCHIVIERT" }, isInternal: false }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const g = t.admin.grants;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{user.name}</h2>
          <p className="text-sm text-muted-foreground">{user.email} · <Badge>{user.active ? t.admin.users.active : t.admin.users.blocked}</Badge></p>
        </div>
        {manage && !self && (
          <div className="flex flex-wrap items-center gap-2">
            {user.active && <Link href={`/verwaltung/nutzer/${user.id}/offboarding`} className="text-sm underline">{t.admin.offboarding.start}</Link>}
            <ActiveToggle userId={user.id} active={user.active} />
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle className="mb-3">{t.admin.users.role}</CardTitle>
          {manage && !self ? (
            <RoleForm userId={user.id} role={user.role} isAdmin={user.isAdmin} />
          ) : (
            <p className="text-sm">{t.common.roles[user.role]}{user.isAdmin ? ` · ${t.common.admin}` : ""}</p>
          )}
        </Card>

        <Card>
          <CardTitle>{g.title}</CardTitle>
          {user.permissionGrants.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{g.none}</p> : (
            <ul className="mt-2 divide-y text-sm">
              {user.permissionGrants.map((grant) => (
                <li key={grant.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span>
                    {g.labels[grant.permission]} · {grant.client?.name ?? g.allClients}
                    <span className="block text-xs text-muted-foreground">{g.grantedBy(grant.grantedBy.name, formatDate(grant.grantedAt))}</span>
                  </span>
                  {manage && <RevokeGrantButton grantId={grant.id} />}
                </li>
              ))}
            </ul>
          )}
          {manage && (
            <div className="mt-4 border-t pt-4">
              <GrantForm userId={user.id} clients={clients} allowSelfApprove={canGrantPermission(actor, { userId: user.id, permission: "SELF_APPROVE" })} />
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>{t.admin.memberships.title}</CardTitle>
          {user.clientMembers.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{t.admin.memberships.none}</p> : (
            <ul className="mt-2 divide-y text-sm">
              {user.clientMembers.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span>{m.client.name} · {t.common.memberKind[m.kind]}{m.canApprove ? ` · ${t.clients.canApprove}` : ""}</span>
                  {manage && <RemoveMembershipButton clientId={m.client.id} userId={user.id} />}
                </li>
              ))}
            </ul>
          )}
          {manage && clients.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <MembershipForm userId={user.id} clients={clients} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
