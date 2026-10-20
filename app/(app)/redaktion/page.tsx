import Link from "next/link";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskTable } from "@/components/tasks/task-table";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { selectedClientName } from "@/lib/domain/clients/current";
import { listTasks, type StatusFilter } from "@/lib/domain/tasks/queries";
import { OPEN_STATUSES } from "@/lib/domain/tasks/rules";
import type { Priority, TaskStatus } from "@/lib/generated/prisma/enums";
import { requireUser } from "@/lib/session";
import { atTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type Params = {
  ansicht?: string;
  projekt?: string;
  owner?: string;
  status?: string;
  form?: string;
  prio?: string;
  von?: string;
  bis?: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function RedaktionPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  const p = await searchParams;
  const view = p.ansicht === "tafel" ? "tafel" : "liste";
  const clientId = user.selectedClientId;
  const now = new Date();
  const statusValues = Object.keys(t.tasks.statuses) as TaskStatus[];
  const status: StatusFilter =
    p.status === "ALLE" ? "ALLE" : statusValues.includes(p.status as TaskStatus) ? (p.status as TaskStatus) : "OFFEN_ALLE";
  const priority = (Object.keys(t.tasks.priorities) as Priority[]).find((k) => k === p.prio) ?? null;

  const [tasks, projects, owners, formats, clientName] = await Promise.all([
    listTasks(
      prisma,
      {
        clientId,
        projectId: p.projekt || null,
        ownerId: p.owner || null,
        status,
        format: p.form || null,
        priority,
        dueFrom: p.von && DATE.test(p.von) ? atTime(p.von, "00:00") : null,
        dueTo: p.bis && DATE.test(p.bis) ? atTime(p.bis, "23:59") : null,
      },
      now,
    ),
    prisma.project.findMany({ where: { clientId: clientId ?? undefined }, orderBy: { title: "asc" }, include: { client: { select: { name: true } } } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.documentFormat.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, name: true } }),
    selectedClientName(prisma, clientId),
  ]);

  const r = t.redaktion;
  const query = (overrides: Partial<Params>) => {
    const merged = { ...p, ...overrides };
    const sp = new URLSearchParams(Object.entries(merged).filter((e): e is [string, string] => !!e[1]));
    return `/redaktion?${sp.toString()}`;
  };
  const boardStatuses = status === "OFFEN_ALLE" ? OPEN_STATUSES : status === "ALLE" ? [...OPEN_STATUSES, "ERLEDIGT" as const] : [status];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{r.title}</h1>
          <p data-testid="client-filter" className="text-sm text-muted-foreground">
            {clientName ? t.dashboard.filterActive(clientName) : t.dashboard.filterAll} · {r.count(tasks.length)}
          </p>
        </div>
        <nav aria-label={r.viewLabel} className="flex gap-1 rounded-md border p-1">
          {(["liste", "tafel"] as const).map((v) => (
            <Link
              key={v}
              href={query({ ansicht: v })}
              aria-current={view === v ? "page" : undefined}
              className={cn("rounded px-3 py-1 text-sm", view === v ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
            >
              {r.views[v]}
            </Link>
          ))}
        </nav>
      </div>

      {/* key: nach Filtern oder Zurücksetzen zeigen die Felder die Werte aus der Adresse */}
      <form key={JSON.stringify(p)} method="get" className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label={r.filters.legend}>
        <input type="hidden" name="ansicht" value={view} />
        <Field label={r.filters.project} htmlFor="f-projekt">
          <Select id="f-projekt" name="projekt" defaultValue={p.projekt ?? ""}>
            <option value="">{r.filters.all}</option>
            {projects.map((pr) => (
              <option key={pr.id} value={pr.id}>{clientId ? pr.title : `${pr.client.name}: ${pr.title}`}</option>
            ))}
          </Select>
        </Field>
        <Field label={r.filters.owner} htmlFor="f-owner">
          <Select id="f-owner" name="owner" defaultValue={p.owner ?? ""}>
            <option value="">{r.filters.all}</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Field>
        <Field label={r.filters.status} htmlFor="f-status">
          <Select id="f-status" name="status" defaultValue={status}>
            <option value="OFFEN_ALLE">{r.filters.openAll}</option>
            <option value="ALLE">{r.filters.everything}</option>
            {statusValues.map((s) => <option key={s} value={s}>{t.tasks.statuses[s]}</option>)}
          </Select>
        </Field>
        <Field label={r.filters.format} htmlFor="f-form">
          <Select id="f-form" name="form" defaultValue={p.form ?? ""}>
            <option value="">{r.filters.all}</option>
            <option value="AUFGABE">{r.filters.simpleTask}</option>
            {formats.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
          </Select>
        </Field>
        <Field label={r.filters.priority} htmlFor="f-prio">
          <Select id="f-prio" name="prio" defaultValue={priority ?? ""}>
            <option value="">{r.filters.all}</option>
            {(Object.keys(t.tasks.priorities) as Priority[]).map((k) => <option key={k} value={k}>{t.tasks.priorities[k]}</option>)}
          </Select>
        </Field>
        <Field label={r.filters.dueFrom} htmlFor="f-von">
          <Input id="f-von" name="von" type="date" defaultValue={p.von ?? ""} />
        </Field>
        <Field label={r.filters.dueTo} htmlFor="f-bis">
          <Input id="f-bis" name="bis" type="date" defaultValue={p.bis ?? ""} />
        </Field>
        <div className="flex items-end gap-2">
          <Button type="submit">{r.filters.apply}</Button>
          <Button asChild variant="ghost"><Link href={`/redaktion?ansicht=${view}`}>{r.filters.reset}</Link></Button>
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">{r.clientHint}</p>
      </form>

      {view === "liste" ? <TaskTable tasks={tasks} now={now} /> : <TaskBoard tasks={tasks} statuses={boardStatuses} now={now} />}
    </div>
  );
}
