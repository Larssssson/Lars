import { notFound } from "next/navigation";
import { Warnings } from "@/components/dashboard/blocks";
import { EditClientForm, LogoForm, MembershipForm, RemoveMembershipButton, StatusActions } from "@/components/clients/client-forms";
import { TaskTable } from "@/components/tasks/task-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { servicesWithProgress } from "@/lib/domain/clients/services";
import { warningsForClient } from "@/lib/domain/clients/warnings";
import { canManageClients, canManageUsers, canSeeClientWarnings } from "@/lib/domain/permissions";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import { listTasks } from "@/lib/domain/tasks/queries";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const client = await prisma.client
    .findUnique({ where: { id }, include: { members: { include: { user: { select: { id: true, name: true } } } } } })
    .catch(() => null);
  if (!client) notFound();

  const now = new Date();
  const ctx = await loadPermissionContext(prisma, user.id);
  const [services, warnings, tasks, users] = await Promise.all([
    servicesWithProgress(prisma, client.id, now),
    client.status === "AKTIV" && canSeeClientWarnings(user, ctx, client.id) ? warningsForClient(prisma, client, now) : Promise.resolve(null),
    listTasks(prisma, { clientId: client.id }, now),
    canManageUsers(user) ? prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const c = t.clients;
  const manage = canManageClients(user);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {client.logoFileId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/dateien/${client.logoFileId}`} alt={`${c.fields.logo} ${client.name}`} className="h-12 w-auto" />
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <p className="text-sm text-muted-foreground">
              <Badge>{t.common.clientStatus[client.status]}</Badge> {client.cluster} · {client.industry}
            </p>
          </div>
        </div>
        {manage && <StatusActions clientId={client.id} status={client.status} />}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          {manage ? (
            <Card>
              <CardTitle className="mb-4">{c.masterData}</CardTitle>
              <EditClientForm
                clientId={client.id}
                values={{ name: client.name, shortName: client.shortName, industry: client.industry ?? "", cluster: client.cluster ?? "", aiAllowed: client.aiAllowed }}
              />
              <div className="mt-5 border-t pt-4">
                {!client.logoFileId && <p className="mb-2 text-sm text-muted-foreground">{c.noLogo}</p>}
                <LogoForm clientId={client.id} />
              </div>
            </Card>
          ) : (
            <Card>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{c.fields.shortName}</dt><dd>{client.shortName}</dd>
                <dt className="text-muted-foreground">{c.fields.aiAllowed}</dt><dd>{client.aiAllowed ? t.common.yes : t.common.no}</dd>
              </dl>
            </Card>
          )}
          <Card>
            <CardTitle>{c.members}</CardTitle>
            {client.members.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{c.noMembers}</p> : (
              <ul className="mt-2 divide-y text-sm">
                {client.members
                  .sort((a, b) => (a.kind === b.kind ? a.user.name.localeCompare(b.user.name, "de") : a.kind === "LEAD" ? -1 : 1))
                  .map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span>
                        {m.user.name} <span className="text-muted-foreground">· {t.common.memberKind[m.kind]}{m.canApprove ? ` · ${c.canApprove}` : ""}</span>
                      </span>
                      {canManageUsers(user) && <RemoveMembershipButton clientId={client.id} userId={m.user.id} />}
                    </li>
                  ))}
              </ul>
            )}
            {canManageUsers(user) && <div className="mt-4 border-t pt-4"><MembershipForm clientId={client.id} users={users} /></div>}
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          {warnings && <Warnings warnings={warnings} />}
          <Card>
            <CardTitle>{c.services}</CardTitle>
            {services.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{c.servicesEmpty}</p> : (
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                {services.map((s) => (
                  <li key={s.id} className="flex flex-wrap justify-between gap-2">
                    <span>{s.title} <span className="text-muted-foreground">· {s.period}</span></span>
                    <span className={cn(s.behind && "font-semibold text-destructive")}>
                      {c.serviceProgress(s.done, s.targetCount)}{s.behind ? ` · ${c.behind}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <p className="text-sm text-muted-foreground">{c.profileLater}</p>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{c.openTasks}</h2>
        <TaskTable tasks={tasks} now={now} />
      </section>
    </div>
  );
}
