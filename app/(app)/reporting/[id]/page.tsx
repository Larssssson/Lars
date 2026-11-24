import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportActions } from "@/components/reports/report-actions";
import { ReportForm } from "@/components/reports/report-form";
import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { isCvd } from "@/lib/domain/permissions";
import { canApproveReport } from "@/lib/domain/reports/service";
import { requireUser } from "@/lib/session";
import { dateKey, formatDate } from "@/lib/time";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const report = await prisma.report.findUnique({ where: { id }, include: { client: { select: { id: true, name: true } }, file: { select: { name: true } } } }).catch(() => null);
  if (!report) notFound();
  const approver = report.approvedBy ? await prisma.user.findUnique({ where: { id: report.approvedBy }, select: { name: true } }) : null;
  const d = t.reports.detail;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <Link href="/reporting" className="text-sm text-muted-foreground hover:underline">← {t.reports.title}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="kicker">{report.client.name}</p>
          <h1 className="text-3xl">{report.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(report.periodStart)} – {formatDate(report.periodEnd)} · {t.reports.templates[report.template].name}
            {report.file ? ` · ${report.file.name}` : ""}
          </p>
        </div>
        <Badge>{report.status === "FREIGEGEBEN" && approver && report.approvedAt ? t.reports.doc.approved(approver.name, formatDate(report.approvedAt)) : t.reports.status[report.status]}</Badge>
      </div>

      <ReportActions
        reportId={report.id}
        approved={report.status === "FREIGEGEBEN"}
        canApprove={await canApproveReport({ db: prisma }, user, report)}
        canDelete={user.id === report.createdBy || isCvd(user)}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-label={d.preview}>
          <h2 className="kicker mb-2">{d.preview}</h2>
          <iframe title={d.preview} src={`/api/reporting/${report.id}/vorschau`} className="h-[1100px] w-full rounded-md border bg-white" data-testid="report-preview" />
        </section>
        <section aria-label={d.settings}>
          <h2 className="kicker mb-2">{d.settings}</h2>
          {report.status === "FREIGEGEBEN" && <p className="mb-3 text-xs text-muted-foreground">{d.changedAfterApproval}</p>}
          <ReportForm
            reportId={report.id}
            hasFile={Boolean(report.file)}
            clients={[report.client]}
            values={{
              clientId: report.clientId,
              title: report.title,
              template: report.template,
              from: dateKey(report.periodStart),
              to: dateKey(report.periodEnd),
              blocks: report.blocks,
              clientAliases: report.clientAliases,
              competitors: report.competitors,
              tier1: report.tier1,
              tier2: report.tier2,
              excludePaid: report.excludePaid,
              topicFilter: report.topicFilter,
              commentary: report.commentary ?? "",
            }}
          />
        </section>
      </div>
    </div>
  );
}
