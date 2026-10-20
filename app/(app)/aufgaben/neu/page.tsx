import { TaskForm } from "@/components/tasks/task-form";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { canCreateTaskForOthers, hasGrant, isCvd } from "@/lib/domain/permissions";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import { approversForClient } from "@/lib/domain/permissions/queries";
import { DEFAULT_DUE_OPTION, dueOptions, type DueOption } from "@/lib/domain/tasks/rules";
import { requireUser } from "@/lib/session";
import { toLocalInput } from "@/lib/time";

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ kunde?: string }> }) {
  const user = await requireUser();
  const { kunde } = await searchParams;
  const clients = await prisma.client.findMany({ where: { status: { not: "ARCHIVIERT" } }, orderBy: { name: "asc" } });
  // vorbelegt mit der Kundenauswahl der Kopfzeile (BRIEFING 6.1)
  const clientId = clients.find((c) => c.id === (kunde ?? user.selectedClientId))?.id ?? null;
  const ctx = await loadPermissionContext(prisma, user.id);
  // ohne gewählten Kunden: nur wer für alle Kunden Aufgaben für andere anlegen darf
  const canAssignOthers = clientId
    ? canCreateTaskForOthers(user, ctx, clientId)
    : isCvd(user) || hasGrant(ctx, "CREATE_TASKS_FOR_OTHERS");

  const [formats, owners, projects, services, approvers] = await Promise.all([
    prisma.documentFormat.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, name: true } }),
    canAssignOthers ? prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [],
    clientId ? prisma.project.findMany({ where: { clientId, status: { in: ["GEPLANT", "LAUFEND"] } }, orderBy: { title: "asc" } }) : [],
    clientId ? prisma.agreedService.findMany({ where: { clientId }, orderBy: { title: "asc" } }) : [],
    clientId ? approversForClient(prisma, clientId) : [],
  ]);

  // Team des Kunden zuerst als Owner-Vorschlag (BRIEFING 3.2)
  const team = clientId ? new Set((await prisma.clientMember.findMany({ where: { clientId } })).map((m) => m.userId)) : new Set<string>();
  const ownerOptions = canAssignOthers
    ? [...owners].sort((a, b) => Number(team.has(b.id)) - Number(team.has(a.id)) || a.name.localeCompare(b.name, "de"))
    : [{ id: user.id, name: user.name }];

  const options = dueOptions(new Date());
  const dueValues = Object.fromEntries(Object.entries(options).map(([k, v]) => [k, toLocalInput(v)])) as Record<DueOption, string>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.tasks.newTask}</h1>
      <TaskForm
        key={clientId ?? "kein-kunde"}
        clientId={clientId}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        formats={formats}
        owners={ownerOptions}
        selfId={user.id}
        canAssignOthers={canAssignOthers}
        projects={projects.map((p) => ({ id: p.id, name: p.title }))}
        services={services.map((s) => ({ id: s.id, name: s.title }))}
        approvers={approvers.filter((a) => a.id !== user.id)}
        dueOptions={dueValues}
        defaultDue={dueValues[DEFAULT_DUE_OPTION]}
      />
    </div>
  );
}
