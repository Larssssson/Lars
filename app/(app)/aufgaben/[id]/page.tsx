import Link from "next/link";
import { notFound } from "next/navigation";
import { PriorityBadge, StatusBadge } from "@/components/tasks/badges";
import { StatusButtons, UrgentToggle } from "@/components/tasks/task-actions";
import { TaskEditForm } from "@/components/tasks/task-edit-form";
import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { parseBlocks } from "@/lib/domain/documents/template";
import { canCreateTaskForOthers, canEditTask, canEscalatePriority } from "@/lib/domain/permissions";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import { approversForClient } from "@/lib/domain/permissions/queries";
import { getTask } from "@/lib/domain/tasks/queries";
import { computePriority, SIMPLE_TASK_TRANSITIONS } from "@/lib/domain/tasks/rules";
import { requireUser } from "@/lib/session";
import { formatDateTime, formatRelative, toLocalInput } from "@/lib/time";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const task = await getTask(prisma, id).catch(() => null);
  if (!task) notFound();

  const now = new Date();
  const ctx = await loadPermissionContext(prisma, user.id);
  const editable = canEditTask(user, ctx, task);
  const priority = computePriority(task.dueAt, task.priorityManual, now);
  const f = t.tasks.fields;
  const format = task.document
    ? await prisma.documentFormat.findUnique({ where: { key: task.document.format } })
    : null;

  const [owners, approvers] = editable
    ? await Promise.all([
        canCreateTaskForOthers(user, ctx, task.clientId)
          ? prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
          : Promise.resolve([{ id: task.owner.id, name: task.owner.name }]),
        approversForClient(prisma, task.clientId),
      ])
    : [[], []];

  const facts: [string, React.ReactNode][] = [
    [f.client, task.client.name],
    [f.owner, task.owner.name],
    [f.due, <span key="due">{formatDateTime(task.dueAt)} <span className="text-muted-foreground">({formatRelative(task.dueAt, now)})</span></span>],
    [f.embargo, task.embargoAt ? formatDateTime(task.embargoAt) : "–"],
    [f.category, t.tasks.categories[task.category]],
    [f.type, task.document?.documentFormat.name ?? t.tasks.types.AUFGABE],
    [f.project, task.project?.title ?? "–"],
    [f.agreedService, task.agreedService?.title ?? "–"],
    [f.preferredApprover, task.preferredApprover?.name ?? "–"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/redaktion" className="underline">
            {t.redaktion.title}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={priority} />
          {task.priorityManual && <span className="text-xs text-muted-foreground">{t.tasks.manualUrgent}</span>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {facts.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {task.description && <p className="mt-4 text-sm whitespace-pre-wrap">{task.description}</p>}
          <div className="mt-4">
            <p className="text-sm font-medium">{f.attachments}</p>
            {task.attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.tasks.noAttachments}</p>
            ) : (
              <ul className="text-sm">
                {task.attachments.map((a) => (
                  <li key={a.id}>
                    <a className="underline" href={`/api/dateien/${a.id}`}>
                      {a.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {editable && task.type === "AUFGABE" && (
              <StatusButtons
                taskId={task.id}
                current={task.status}
                next={SIMPLE_TASK_TRANSITIONS[task.status as keyof typeof SIMPLE_TASK_TRANSITIONS] ?? []}
              />
            )}
            {canEscalatePriority(user) && task.status !== "ARCHIVIERT" && (
              <UrgentToggle taskId={task.id} marked={task.priorityManual === "DRINGEND"} />
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          {task.document && format && (
            <Card>
              <CardTitle>{task.document.documentFormat.name}</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">{t.tasks.documentPlaceholder}</p>
              <p className="mt-4 text-sm font-medium">{t.tasks.templateBlocks}</p>
              <ul className="mt-1 flex flex-wrap gap-2 text-sm">
                {parseBlocks(format.blocks).map((b) => (
                  <li key={b.key} className="rounded border px-2 py-0.5">
                    {b.label}
                    {b.required && <span className="ml-1 text-xs text-muted-foreground">({t.tasks.required})</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {editable && task.status !== "ARCHIVIERT" && (
            <Card>
              <CardTitle className="mb-4">{t.tasks.editTask}</CardTitle>
              <TaskEditForm
                taskId={task.id}
                title={task.title}
                description={task.description ?? ""}
                dueAt={toLocalInput(task.dueAt)}
                embargoAt={task.embargoAt ? toLocalInput(task.embargoAt) : ""}
                ownerId={task.ownerId}
                preferredApproverId={task.preferredApprover?.id ?? ""}
                owners={owners}
                approvers={approvers.filter((a) => a.id !== task.ownerId)}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
