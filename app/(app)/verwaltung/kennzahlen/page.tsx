import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { metrics } from "@/lib/domain/metrics";
import { canManageTechnicalSettings } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";
import { formatDate, startOfDay } from "@/lib/time";

export const dynamic = "force-dynamic";

function Table({ head, rows, testId }: { head: string[]; rows: ReactNode[][]; testId: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid={testId}>
        <thead className="text-left text-xs text-muted-foreground">
          <tr>{head.map((h) => <th key={h} scope="col" className="py-1 pr-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-t">{cells.map((c, j) => <td key={j} className="py-1.5 pr-3">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Kennzahlen (BRIEFING 7.10), nur Admin (BRIEFING 3.1). */
export default async function MetricsPage() {
  const user = await requireUser();
  if (!canManageTechnicalSettings(user)) notFound();
  const m = await metrics({ db: prisma, now: () => new Date() }, user);
  const k = t.admin.metrics;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{k.intro}</p>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle className="mb-3">{k.activeUsers}</CardTitle>
          <Table testId="metric-active-users" head={[k.week, k.users]} rows={m.activeUsersPerWeek.map((w) => [formatDate(startOfDay(w.week)), w.users])} />
        </Card>
        <Card>
          <CardTitle className="mb-3">{k.tasksByStatus}</CardTitle>
          <Table testId="metric-tasks" head={[k.status, k.count]} rows={m.tasksByStatus.map((s) => [t.tasks.statuses[s.status] ?? s.status, s.count])} />
        </Card>
        <Card>
          <CardTitle className="mb-3">{k.approvalTime}</CardTitle>
          <p className="text-sm" data-testid="metric-approval-time">{k.approvalTimeValue(m.approvalTime.minutes, m.approvalTime.count)}</p>
        </Card>
        <Card>
          <CardTitle className="mb-3">{k.reviewShifts}</CardTitle>
          <p className="text-sm" data-testid="metric-review-shifts">{k.reviewShiftsValue(m.reviewShifts.done, m.reviewShifts.total)}</p>
        </Card>
        <Card>
          <CardTitle className="mb-3">{k.push}</CardTitle>
          {m.pushPerPersonDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">{k.noPush}</p>
          ) : (
            <Table testId="metric-push" head={[k.day, k.person, k.count]} rows={m.pushPerPersonDay.map((p) => [formatDate(startOfDay(p.day)), p.name, p.count])} />
          )}
        </Card>
        <Card>
          <CardTitle className="mb-3">{k.verified}</CardTitle>
          <Table testId="metric-verified" head={[k.month, k.verifiedCount]} rows={m.verifiedContacts.map((v) => [v.month.split("-").reverse().join("."), v.count])} />
        </Card>
      </div>
    </div>
  );
}
