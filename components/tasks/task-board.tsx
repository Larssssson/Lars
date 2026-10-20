import Link from "next/link";
import { t } from "@/i18n";
import type { TaskRow } from "@/lib/domain/tasks/queries";
import type { TaskStatus } from "@/lib/generated/prisma/enums";
import { formatRelative } from "@/lib/time";
import { PriorityBadge } from "./badges";
import { formatName } from "./task-table";

/** Tafel mit einer Spalte pro Status (BRIEFING 7.2). */
export function TaskBoard({ tasks, statuses, now }: { tasks: TaskRow[]; statuses: TaskStatus[]; now: Date }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {statuses.map((status) => {
        const column = tasks.filter((task) => task.status === status);
        return (
          <section key={status} aria-label={t.tasks.statuses[status]} className="flex w-64 shrink-0 flex-col gap-2 rounded-lg bg-muted p-2">
            <h2 className="flex justify-between px-1 text-sm font-semibold">
              {t.tasks.statuses[status]}
              <span className="text-muted-foreground">{column.length}</span>
            </h2>
            {column.map((task) => (
              <Link
                key={task.id}
                href={`/aufgaben/${task.id}`}
                className="flex flex-col gap-1 rounded-md border bg-card p-3 text-sm shadow-sm hover:border-ring"
              >
                <span className="text-xs text-muted-foreground">{task.client.name} · {formatName(task)}</span>
                <span className="font-medium">{task.title}</span>
                <span className="flex items-center justify-between gap-2 text-xs">
                  <PriorityBadge priority={task.priority} />
                  <span>{task.owner.name} · {formatRelative(task.dueAt, now)}</span>
                </span>
              </Link>
            ))}
          </section>
        );
      })}
    </div>
  );
}
