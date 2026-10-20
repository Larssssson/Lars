import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/tasks/badges";
import { formatName } from "@/components/tasks/task-table";
import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import type { ClientWarning } from "@/lib/domain/clients/warnings";
import type { TaskRow } from "@/lib/domain/tasks/queries";
import type { DashboardGroup } from "@/lib/domain/tasks/rules";
import { formatDateTime, formatRelative } from "@/lib/time";
import { cn } from "@/lib/utils";

export function TaskLine({ task, now }: { task: TaskRow; now: Date }) {
  return (
    <li>
      <Link
        href={`/aufgaben/${task.id}`}
        className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 hover:bg-accent sm:grid-cols-[7rem_1fr_9rem_auto_8rem]"
      >
        <span className="text-xs text-muted-foreground sm:text-sm">{task.client.name}</span>
        <span className="col-span-2 font-medium sm:col-span-1">{task.title}</span>
        <span className="hidden text-muted-foreground sm:inline">{formatName(task)}</span>
        <StatusBadge status={task.status} />
        <span className="text-right text-sm whitespace-nowrap" title={formatDateTime(task.dueAt)}>
          {formatRelative(task.dueAt, now)}
        </span>
      </Link>
    </li>
  );
}

/** Meine Aufgaben, gruppiert nach Dringend, Heute, Demnächst (BRIEFING 7.1). */
export function MyTasks({ groups, now }: { groups: Record<DashboardGroup, TaskRow[]>; now: Date }) {
  return (
    <Card>
      <CardTitle>{t.dashboard.myTasks}</CardTitle>
      <div className="mt-3 flex flex-col gap-4">
        {(Object.keys(groups) as DashboardGroup[]).map((group) => (
          <section key={group} aria-labelledby={`group-${group}`}>
            <h3 id={`group-${group}`} className={cn("mb-1 text-sm font-semibold", group === "DRINGEND" && "text-destructive")}>
              {t.dashboard.groups[group]} <span className="font-normal text-muted-foreground">({groups[group].length})</span>
            </h3>
            {groups[group].length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">{t.dashboard.emptyGroup}</p>
            ) : (
              <ul className="divide-y">{groups[group].map((task) => <TaskLine key={task.id} task={task} now={now} />)}</ul>
            )}
          </section>
        ))}
      </div>
    </Card>
  );
}

export function Warnings({ warnings }: { warnings: ClientWarning[] }) {
  return (
    <Card>
      <CardTitle>{t.dashboard.warnings}</CardTitle>
      {warnings.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t.dashboard.warningsEmpty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {warnings.map((w, i) => (
            <li key={`${w.clientId}-${w.kind}-${i}`}>
              <Link href={w.link} className={cn("flex gap-2 rounded-md p-2 hover:bg-accent", w.severity === "ROT" && "text-destructive")}>
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span><strong>{w.clientName}:</strong> {w.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

