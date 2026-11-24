import Link from "next/link";
import { ReportForm } from "@/components/reports/report-form";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { reportDefaults } from "@/lib/domain/reports/service";
import { TEMPLATES } from "@/lib/domain/reports/templates";
import { requireUser } from "@/lib/session";
import { dateKey } from "@/lib/time";

/** Neues Reporting: Kunde aus der Kopfzeile oder ?kunde=, Zeitraum Vormonat, Vorbelegung aus Profil oder letztem Reporting. */
export default async function NewReportPage({ searchParams }: { searchParams: Promise<{ kunde?: string }> }) {
  const user = await requireUser();
  const clients = await prisma.client.findMany({ where: { isInternal: false, status: { not: "ARCHIVIERT" } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const wanted = (await searchParams).kunde ?? user.selectedClientId ?? "";
  const clientId = clients.some((c) => c.id === wanted) ? wanted : "";
  const defaults = clientId ? await reportDefaults({ db: prisma }, clientId) : { competitors: [], tier1: [], tier2: [], clientAliases: [], excludePaid: true, topicFilter: [] };
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 12));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 12));
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <Link href="/reporting" className="text-sm text-muted-foreground hover:underline">← {t.reports.title}</Link>
      <h1 className="text-3xl">{t.reports.newReport}</h1>
      <ReportForm
        key={clientId}
        clients={clients}
        values={{ clientId, title: "", template: "MONATSBERICHT", from: dateKey(first), to: dateKey(last), blocks: TEMPLATES.MONATSBERICHT.defaults, commentary: "", ...defaults }}
      />
    </div>
  );
}
