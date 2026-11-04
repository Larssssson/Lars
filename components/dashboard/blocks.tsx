import Link from "next/link";
import { StatusBadge } from "@/components/tasks/badges";
import { formatName } from "@/components/tasks/task-table";
import { t } from "@/i18n";
import type { ClientWarning } from "@/lib/domain/clients/warnings";
import type { TaskRow } from "@/lib/domain/tasks/queries";
import type { DashboardGroup } from "@/lib/domain/tasks/rules";
import { formatDateTime, formatRelative } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Eine Zeile wie in einem Tagesplan: Frist links, Titel in der Zeitungsschrift, Status rechts. */
export function TaskLine({ task, now }: { task: TaskRow; now: Date }) {
  return (
    <li>
      <Link
        href={`/aufgaben/${task.id}`}
        className="group grid grid-cols-[1fr_auto] items-baseline gap-x-5 gap-y-1 border-b py-3.5 sm:grid-cols-[7.5rem_1fr_auto]"
      >
        <span
          className={cn("text-[13px] whitespace-nowrap text-muted-foreground tabular-nums", task.priority === "DRINGEND" && "font-semibold text-destructive")}
          title={formatDateTime(task.dueAt)}
        >
          {formatRelative(task.dueAt, now)}
        </span>
        <span className="col-span-2 sm:col-span-1">
          <span className="block font-serif text-xl leading-snug font-medium tracking-tight group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{task.title}</span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground">{task.client.name} · {formatName(task)}</span>
        </span>
        <span className="col-start-2 row-start-1 sm:col-start-3"><StatusBadge status={task.status} /></span>
      </Link>
    </li>
  );
}

/** Meine Aufgaben, gruppiert nach Dringend, Heute, Demnächst (BRIEFING 7.1). */
export function MyTasks({ groups, now }: { groups: Record<DashboardGroup, TaskRow[]>; now: Date }) {
  return (
    <section aria-labelledby="my-tasks">
      <h2 id="my-tasks" className="kicker">{t.dashboard.myTasks}</h2>
      <div className="mt-2 flex flex-col gap-5">
        {(Object.keys(groups) as DashboardGroup[]).filter((g) => groups[g].length > 0).map((group) => (
          <section key={group} aria-labelledby={`group-${group}`}>
            <h3 id={`group-${group}`} className={cn("border-b border-rule pt-2 pb-1.5 text-[13px] font-semibold", group === "DRINGEND" && "text-destructive")}>
              {t.dashboard.groups[group]} <span className="font-normal text-muted-foreground">({groups[group].length})</span>
            </h3>
            <ul>{groups[group].map((task) => <TaskLine key={task.id} task={task} now={now} />)}</ul>
          </section>
        ))}
      </div>
    </section>
  );
}

/** Profilwarnungen und Leistungsrückstand als kurze Notizen (BRIEFING 7.1, 7.7). */
export function Warnings({ warnings }: { warnings: ClientWarning[] }) {
  return (
    <section aria-labelledby="warnings">
      <h2 id="warnings" className="kicker">{t.dashboard.warnings}</h2>
      {warnings.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t.dashboard.warningsEmpty}</p>
      ) : (
        <ul className="mt-2">
          {warnings.map((w, i) => (
            <li key={`${w.clientId}-${w.kind}-${i}`}>
              <Link href={w.link} className="block border-b py-2.5 text-sm leading-snug hover:underline hover:decoration-1 hover:underline-offset-4">
                <span className={cn("mr-1.5 inline-block size-2 rounded-full align-middle", w.severity === "ROT" ? "bg-destructive" : "bg-amber-500")} aria-hidden />
                <strong className="font-semibold">{w.clientName}.</strong> {w.text}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
