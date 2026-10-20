import Link from "next/link";
import { TaskTable } from "@/components/tasks/task-table";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { search } from "@/lib/domain/tasks/queries";
import { computePriority } from "@/lib/domain/tasks/rules";
import { requireUser } from "@/lib/session";

/** Suche über Aufgaben und Kunden (BRIEFING 4, DECISIONS D-022). */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const { q = "" } = await searchParams;
  const now = new Date();
  const result = await search(prisma, q);
  const s = t.search;
  const tasks = result.tasks.map((task) => ({ ...task, priority: computePriority(task.dueAt, task.priorityManual, now) }));
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">{q ? s.resultsFor(q) : s.title}</h1>
      {q.trim().length < 2 ? (
        <p className="text-sm text-muted-foreground">{s.tooShort}</p>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{s.clients}</h2>
            {result.clients.length === 0 ? <p className="text-sm text-muted-foreground">{s.none}</p> : (
              <ul className="flex flex-wrap gap-2">
                {result.clients.map((c) => (
                  <li key={c.id}><Link href={`/kunden/${c.id}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">{c.name}</Link></li>
                ))}
              </ul>
            )}
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{s.tasks}</h2>
            <TaskTable tasks={tasks} now={now} />
          </section>
          <p className="text-xs text-muted-foreground">{s.laterHint}</p>
        </>
      )}
    </div>
  );
}
