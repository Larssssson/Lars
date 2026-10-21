import Link from "next/link";
import { notFound } from "next/navigation";
import { completeOffboardingAction, reassignTaskAction, resolveContactAction } from "@/app/(app)/verwaltung/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { offboardingOverview } from "@/lib/domain/permissions/offboarding";
import { requireUser } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

/** Offboarding einer Person (BRIEFING 6.9). */
export default async function OffboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireUser();
  const overview = await offboardingOverview(prisma, actor, id).catch(() => null);
  if (!overview) notFound();
  const users = await prisma.user.findMany({ where: { active: true, NOT: { id } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const counts = await prisma.contactOwner.groupBy({ by: ["journalistId"], where: { journalistId: { in: overview.contacts.map((c) => c.journalistId) }, active: true, NOT: { userId: id } }, _count: true });
  const o = t.admin.offboarding;
  const UserSelect = ({ name, idPrefix }: { name: string; idPrefix: string }) => (
    <Select id={idPrefix} name={name} defaultValue="" required className="h-8 w-44">
      <option value="" disabled>{t.common.pleaseChoose}</option>
      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </Select>
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted-foreground"><Link className="underline" href={`/verwaltung/nutzer/${id}`}>{overview.user.name}</Link></p>
        <h2 className="text-xl font-semibold">{o.title}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{o.intro}</p>
      </div>

      <Card className="p-4">
        <CardTitle>{o.tasks}</CardTitle>
        {overview.tasks.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{o.noTasks}</p> : (
          <ul className="mt-2 divide-y text-sm" data-testid="offboarding-tasks">
            {overview.tasks.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><Link className="underline" href={`/aufgaben/${task.id}`}>{task.title}</Link> <span className="text-muted-foreground">· {task.client.name} · {formatDateTime(task.dueAt)}</span></span>
                <ActionForm action={reassignTaskAction.bind(null, id, task.id)} className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`task-${task.id}`}>{o.newOwner}</label>
                  <UserSelect name="ownerId" idPrefix={`task-${task.id}`} />
                  <SubmitButton size="sm" variant="outline">{o.reassign}</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <CardTitle>{o.contacts}</CardTitle>
        {overview.contacts.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{o.noContacts}</p> : (
          <ul className="mt-2 divide-y text-sm" data-testid="offboarding-contacts">
            {overview.contacts.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 py-2">
                <span>
                  <Link className="underline" href={`/journo-hub/${row.journalist.id}`}>{row.journalist.firstName} {row.journalist.lastName}</Link>
                  <span className="text-muted-foreground"> · {row.journalist.media?.name ?? t.journo.noMedia} · {o.otherOwners(counts.find((c) => c.journalistId === row.journalistId)?._count ?? 0)}</span>
                </span>
                <div className="flex flex-wrap items-end gap-3">
                  <ActionForm action={resolveContactAction.bind(null, id, row.id)} className="flex items-center gap-2">
                    <input type="hidden" name="kind" value="TRANSFER" />
                    <label className="sr-only" htmlFor={`transfer-${row.id}`}>{o.newOwner}</label>
                    <UserSelect name="userId" idPrefix={`transfer-${row.id}`} />
                    <SubmitButton size="sm" variant="outline">{o.transfer}</SubmitButton>
                  </ActionForm>
                  <ActionForm action={resolveContactAction.bind(null, id, row.id)} className="flex items-end gap-2">
                    <input type="hidden" name="kind" value="NOTE" />
                    <Field label={o.noteLabel} htmlFor={`note-${row.id}`}><Input id={`note-${row.id}`} name="note" required className="h-8 w-56" /></Field>
                    <SubmitButton size="sm" variant="outline">{o.note}</SubmitButton>
                  </ActionForm>
                  <ActionForm action={resolveContactAction.bind(null, id, row.id)}>
                    <input type="hidden" name="kind" value="INACTIVE" />
                    <SubmitButton size="sm" variant="ghost">{o.inactive}</SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {overview.user.active ? (
        <ActionForm action={completeOffboardingAction.bind(null, id)} confirm={o.completeConfirm}>
          <SubmitButton variant="destructive">{o.complete}</SubmitButton>
        </ActionForm>
      ) : (
        <p role="status" className="text-sm font-medium">{o.completed}</p>
      )}
    </div>
  );
}
