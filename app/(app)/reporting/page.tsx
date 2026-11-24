import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/time";

/** Reportings je Kunde; die Kundenauswahl in der Kopfzeile filtert (Grundsatz 5). */
export default async function ReportingPage() {
  const user = await requireUser();
  const reports = await prisma.report.findMany({
    where: user.selectedClientId ? { clientId: user.selectedClientId } : {},
    include: { client: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const authors = await prisma.user.findMany({ where: { id: { in: reports.map((r) => r.createdBy).filter((id): id is string => Boolean(id)) } }, select: { id: true, name: true } });
  const selected = user.selectedClientId ? await prisma.client.findUnique({ where: { id: user.selectedClientId }, select: { name: true } }) : null;
  const r = t.reports;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">{r.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{r.intro}</p>
        </div>
        <Button asChild className="rounded-full"><Link href="/reporting/neu">{r.newReport}</Link></Button>
      </div>
      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">{selected ? r.noneForClient(selected.name) : r.none}</p>
      ) : (
        <ul className="divide-y border-t border-rule" data-testid="report-list">
          {reports.map((report) => (
            <li key={report.id} className="grid gap-1 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <Link href={`/reporting/${report.id}`} className="font-serif text-xl font-medium hover:underline">{report.title}</Link>
                <p className="text-[13px] text-muted-foreground">
                  {report.client.name} · {formatDate(report.periodStart)} – {formatDate(report.periodEnd)} · {r.templates[report.template].name} · {authors.find((a) => a.id === report.createdBy)?.name.split(" ")[0] ?? ""}
                </p>
              </div>
              <Badge>{r.status[report.status]}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
