import Link from "next/link";
import { t } from "@/i18n";
import type { TaskRow } from "@/lib/domain/tasks/queries";
import { formatDateTime, formatRelative } from "@/lib/time";
import { PriorityBadge, StatusBadge } from "./badges";

export function formatName(task: TaskRow): string {
  return task.document?.documentFormat.name ?? t.tasks.types.AUFGABE;
}

/** Aufgabenliste der Redaktion (BRIEFING 7.2). */
export function TaskTable({ tasks, now }: { tasks: TaskRow[]; now: Date }) {
  const c = t.redaktion.columns;
  if (tasks.length === 0) return <p className="text-sm text-muted-foreground">{t.redaktion.empty}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">{c.priority}</th>
            <th scope="col" className="px-3 py-2 font-medium">{c.client}</th>
            <th scope="col" className="px-3 py-2 font-medium">{c.title}</th>
            <th scope="col" className="px-3 py-2 font-medium">{c.format}</th>
            <th scope="col" className="px-3 py-2 font-medium">{c.owner}</th>
            <th scope="col" className="px-3 py-2 font-medium">{c.status}</th>
            <th scope="col" className="px-3 py-2 font-medium">{c.due}</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-t">
              <td className="px-3 py-2"><PriorityBadge priority={task.priority} /></td>
              <td className="px-3 py-2">{task.client.name}</td>
              <td className="px-3 py-2">
                <Link href={`/aufgaben/${task.id}`} className="font-medium hover:underline">{task.title}</Link>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{formatName(task)}</td>
              <td className="px-3 py-2">{task.owner.name}</td>
              <td className="px-3 py-2"><StatusBadge status={task.status} /></td>
              <td className="px-3 py-2 whitespace-nowrap" title={formatDateTime(task.dueAt)}>{formatRelative(task.dueAt, now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
