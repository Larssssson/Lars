import Link from "next/link";
import { MyTasks, TaskLine, Warnings } from "@/components/dashboard/blocks";
import { WeekGrid } from "@/components/shifts/week-grid";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { selectedClientName } from "@/lib/domain/clients/current";
import { warningsFor } from "@/lib/domain/clients/warnings";
import { canSeeTeamView, isCvd } from "@/lib/domain/permissions";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import { shiftsOn, weekView } from "@/lib/domain/shifts";
import { monitoringTile } from "@/lib/domain/monitoring/relevance";
import { approvalsWaitingFor, myTasksGrouped, openDocumentsByStatus, teamView } from "@/lib/domain/tasks/dashboard";
import { OPEN_STATUSES } from "@/lib/domain/tasks/rules";
import { requireUser } from "@/lib/session";
import { dateKey, formatWaiting } from "@/lib/time";
import { cn } from "@/lib/utils";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ ansicht?: string }> }) {
  const user = await requireUser();
  const { ansicht } = await searchParams;
  const now = new Date();
  const today = dateKey(now);
  const clientId = user.selectedClientId;
  const ctx = await loadPermissionContext(prisma, user.id);
  const showTeam = ansicht === "team" && canSeeTeamView(user);
  const mayApprove = isCvd(user) || ctx.memberships.some((m) => m.canApprove) || ctx.grants.some((g) => g.permission === "APPROVE");
  const isLeadSomewhere = ctx.memberships.some((m) => m.kind === "LEAD");

  const [clientName, mine, approvals, docCounts, todayShifts, week, warnings, team, monitoring] = await Promise.all([
    selectedClientName(prisma, clientId),
    myTasksGrouped(prisma, user.id, clientId, now),
    mayApprove ? approvalsWaitingFor(prisma, user, ctx, clientId) : Promise.resolve([]),
    openDocumentsByStatus(prisma, clientId),
    shiftsOn(prisma, today),
    weekView(prisma, today),
    isCvd(user) || isLeadSomewhere ? warningsFor(prisma, user, ctx, clientId, now) : Promise.resolve(null),
    showTeam ? teamView(prisma, clientId, now) : Promise.resolve(null),
    monitoringTile(prisma, clientId, now),
  ]);
  const d = t.dashboard;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{d.greeting(user.name.split(" ")[0] ?? user.name)}</h1>
          <p data-testid="client-filter" className="text-sm text-muted-foreground">
            {clientName ? d.filterActive(clientName) : d.filterAll}
          </p>
        </div>
        {canSeeTeamView(user) && (
          <nav aria-label={d.teamView} className="flex gap-1 rounded-md border p-1">
            {[
              { href: "/", label: d.myView, active: !showTeam },
              { href: "/?ansicht=team", label: d.teamView, active: showTeam },
            ].map((v) => (
              <Link key={v.href} href={v.href} aria-current={v.active ? "page" : undefined}
                className={cn("rounded px-3 py-1 text-sm", v.active ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                {v.label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {/* Dienst heute (BRIEFING 7.1): schmale Leiste, aufklappbar zur Wochenansicht */}
      <details className="rounded-lg border bg-card px-4 py-2" data-testid="shifts-today">
        <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold">{d.shiftsToday}</span>
          {todayShifts.length === 0 ? (
            <span className="text-muted-foreground">{d.shiftsNone}</span>
          ) : (
            todayShifts.map((s) => (
              <span key={s.id}>
                <span className="text-muted-foreground">{s.shiftType.name}:</span> {s.user.name}
              </span>
            ))
          )}
          <span className="ml-auto text-xs text-muted-foreground underline">{d.showWeek}</span>
        </summary>
        <div className="mt-3 mb-2">
          <WeekGrid week={week} today={today} editable={false} />
        </div>
      </details>

      {team ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardTitle>{d.team.byPerson}</CardTitle>
            <ul className="mt-3 flex flex-col gap-3">
              {team.byPerson.map((p) => (
                <li key={p.name}>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">{p.name} · {d.team.tasksCount(p.tasks.length)}</summary>
                    <ul className="mt-1 divide-y">{p.tasks.map((task) => <TaskLine key={task.id} task={task} now={now} />)}</ul>
                  </details>
                </li>
              ))}
            </ul>
          </Card>
          <div className="flex flex-col gap-5">
            <Card>
              <CardTitle>{d.team.overdue}</CardTitle>
              {team.overdue.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{d.team.none}</p> : (
                <ul className="mt-2 divide-y">{team.overdue.map((task) => <TaskLine key={task.id} task={task} now={now} />)}</ul>
              )}
            </Card>
            <Card>
              <CardTitle>{d.team.longApprovals}</CardTitle>
              {team.longApprovals.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{d.team.none}</p> : (
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {team.longApprovals.map((a) => (
                    <li key={a.id}>
                      <Link href={`/aufgaben/${a.document.task.id}`} className="hover:underline">
                        {a.document.task.client.name}: {a.document.title}
                      </Link>{" "}
                      <span className="text-muted-foreground">({a.document.task.owner.name}, {formatWaiting(a.requestedAt, now)})</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardTitle>{d.team.contactRequests}</CardTitle>
              <p className="mt-2 text-2xl font-semibold" data-testid="open-contact-requests">{team.openContactRequests}</p>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            {mine.total === 0 ? (
              <Card className="flex flex-col items-start gap-3">
                <CardTitle>{d.empty.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{d.empty.text}</p>
                <div className="flex gap-2">
                  <Button asChild><Link href="/aufgaben/neu">{t.header.newTask}</Link></Button>
                  <Button asChild variant="outline"><Link href="/profil#push">{d.empty.setupPush}</Link></Button>
                </div>
              </Card>
            ) : (
              <MyTasks groups={mine.groups} now={now} />
            )}
            {mayApprove && (
              <Card>
                <CardTitle>{d.approvals}</CardTitle>
                {approvals.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">{d.approvalsEmpty}</p>
                ) : (
                  <ul className="mt-2 divide-y">
                    {approvals.map((a) => (
                      <li key={a.id}>
                        <Link href={`/aufgaben/${a.document.task.id}`} className="flex flex-wrap justify-between gap-2 rounded-md px-2 py-2 hover:bg-accent">
                          <span>
                            <span className="text-sm text-muted-foreground">{a.document.task.client.name} · </span>
                            <span className="font-medium">{a.document.title}</span>
                            <span className="text-sm text-muted-foreground"> · {a.document.documentFormat.name}, {d.requestedBy(a.document.task.owner.name)}</span>
                          </span>
                          <span className="text-sm">{d.waiting(formatWaiting(a.requestedAt, now))}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>
          <div className="flex flex-col gap-5">
            {warnings && <Warnings warnings={warnings} />}
            <Card>
              <CardTitle>{d.redaktionTile}</CardTitle>
              <p className="text-sm text-muted-foreground">{d.redaktionTileText}</p>
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {OPEN_STATUSES.map((s) => (
                  <li key={s} className="flex justify-between">
                    <Link href={`/redaktion?status=${s}`} className="hover:underline">{t.tasks.statuses[s]}</Link>
                    <span className="font-medium">{docCounts[s] ?? 0}</span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" size="sm" className="mt-4"><Link href="/redaktion">{d.toRedaktion}</Link></Button>
            </Card>
            <Card data-testid="monitoring-tile">
              <CardTitle>{t.monitoring.tile.title}</CardTitle>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                <li>{monitoring.imported ? t.monitoring.tile.imported(monitoring.imported) : t.monitoring.tile.notImported}</li>
                {monitoring.imported > 0 && <li>{t.monitoring.tile.relevant(monitoring.relevant)} · {t.monitoring.tile.selected(monitoring.selected)}</li>}
                <li className="text-muted-foreground">{monitoring.serviceName ? t.monitoring.tile.service(monitoring.serviceName) : t.monitoring.tile.noService}</li>
              </ul>
              <Button asChild variant="outline" size="sm" className="mt-4"><Link href="/pressespiegel">{t.monitoring.tile.open}</Link></Button>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
