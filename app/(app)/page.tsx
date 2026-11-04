import { firstName } from "@/lib/names";
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
import { dateKey, formatWaiting, formatWeekdayDate } from "@/lib/time";
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

  const dueToday = mine.groups.DRINGEND.length + mine.groups.HEUTE.length;
  const firstApproval = approvals[0];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7">
      {/* Datumszeile wie bei einer Zeitung, darunter Dienst heute (BRIEFING 7.1), aufklappbar zur Wochenansicht */}
      <details className="group border-b border-rule pb-2.5" data-testid="shifts-today">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-5 gap-y-1 text-xs tracking-[0.12em] text-muted-foreground uppercase">
          <span>{formatWeekdayDate(now)}</span>
          <span className="ml-auto flex flex-wrap gap-x-5 gap-y-1">
            <span className="font-semibold text-foreground">{d.shiftsToday}</span>
            {todayShifts.length === 0 ? (
              <span>{d.shiftsNone}</span>
            ) : (
              todayShifts.map((s) => (
                <span key={s.id}>
                  {s.shiftType.name} <b className="font-semibold text-foreground">{firstName(s.user.name)}</b>
                </span>
              ))
            )}
            <span className="underline underline-offset-4">{d.showWeek}</span>
          </span>
        </summary>
        <div className="mt-4 mb-2 tracking-normal normal-case">
          <WeekGrid week={week} today={today} editable={false} />
        </div>
      </details>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-4xl leading-[1.05] sm:text-[3.4rem]">{d.greeting(firstName(user.name))}.</h1>
          <p data-testid="client-filter" className="mt-2 text-sm text-muted-foreground">
            {clientName ? d.filterActive(clientName) : d.filterAll}
          </p>
        </div>
        {canSeeTeamView(user) && (
          <nav aria-label={d.teamView} className="flex gap-1 rounded-full border bg-card p-1">
            {[
              { href: "/", label: d.myView, active: !showTeam },
              { href: "/?ansicht=team", label: d.teamView, active: showTeam },
            ].map((v) => (
              <Link key={v.href} href={v.href} aria-current={v.active ? "page" : undefined}
                className={cn("rounded-full px-4 py-1.5 text-sm", v.active ? "bg-foreground text-background" : "hover:bg-accent")}>
                {v.label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {!team && (
        <p className="-mt-3 max-w-3xl font-serif text-[1.35rem] leading-relaxed text-foreground/85">
          {firstApproval ? (
            <>
              {approvals.length === 1 ? d.lede.oneApproval : d.lede.manyApprovals(approvals.length)}
              <Link href={`/aufgaben/${firstApproval.document.task.id}`} className="text-primary underline decoration-1 underline-offset-4">{firstApproval.document.title}</Link>
              {d.lede.approvalFor(firstApproval.document.task.client.name)}
            </>
          ) : mayApprove ? d.lede.noApproval : null}
          {dueToday === 0 ? d.lede.dueNone : dueToday === 1 ? d.lede.dueOne : d.lede.dueMany(dueToday)}
          {monitoring.relevant > 0 ? d.lede.review(monitoring.relevant) : d.lede.end}
        </p>
      )}

      {team ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardTitle>{d.team.byPerson}</CardTitle>
            <ul className="mt-3 flex flex-col gap-3">
              {team.byPerson.map((p) => (
                <li key={p.name}>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">{firstName(p.name)} · {d.team.tasksCount(p.tasks.length)}</summary>
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
                      <span className="text-muted-foreground">({firstName(a.document.task.owner.name)}, {formatWaiting(a.requestedAt, now)})</span>
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
        <div className="grid gap-x-14 gap-y-10 border-t pt-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-8">
            {mine.total === 0 ? (
              <section className="flex flex-col items-start gap-3">
                <h2 className="font-serif text-2xl font-medium">{d.empty.title}</h2>
                <p className="text-sm text-muted-foreground">{d.empty.text}</p>
                <div className="flex gap-2">
                  <Button asChild className="rounded-full"><Link href="/aufgaben/neu">{t.header.newTask}</Link></Button>
                  <Button asChild variant="outline" className="rounded-full"><Link href="/profil#push">{d.empty.setupPush}</Link></Button>
                </div>
              </section>
            ) : (
              <MyTasks groups={mine.groups} now={now} />
            )}
          </div>
          <div className="flex flex-col gap-9">
            {mayApprove && (
              <section aria-labelledby="approvals">
                <h2 id="approvals" className="kicker">{d.approvals}</h2>
                {approvals.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">{d.approvalsEmpty}</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-5">
                    {approvals.map((a) => (
                      <li key={a.id} className="border-l-[3px] border-primary pl-4">
                        <Link href={`/aufgaben/${a.document.task.id}`} className="group block">
                          <span className="block font-serif text-[1.35rem] leading-snug font-medium tracking-tight group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{a.document.title}</span>
                          <span className="mt-0.5 block text-[13px] text-muted-foreground">
                            {a.document.task.client.name} · {a.document.documentFormat.name} · {d.requestedBy(firstName(a.document.task.owner.name))} · {d.waiting(formatWaiting(a.requestedAt, now))}
                          </span>
                          <span className="mt-2 inline-block text-sm font-semibold text-primary">{d.openText} →</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            <section aria-labelledby="monitoring" data-testid="monitoring-tile">
              <h2 id="monitoring" className="kicker">{t.monitoring.tile.title}</h2>
              {monitoring.imported === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{t.monitoring.tile.notImported}</p>
              ) : (
                <ul className="mt-3 grid grid-cols-3 gap-4">
                  {[
                    [monitoring.imported, t.monitoring.tile.importedLabel, ""],
                    [monitoring.relevant, t.monitoring.tile.relevantLabel, "text-primary"],
                    [monitoring.selected, t.monitoring.tile.selectedLabel, ""],
                  ].map(([n, label, color]) => (
                    <li key={String(label)} className="flex flex-col">
                      <b className={cn("font-serif text-[2.6rem] leading-none font-medium tabular-nums", String(color))}>{n}</b> <span className="mt-1 text-xs text-muted-foreground">{label}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[13px] text-muted-foreground">{monitoring.serviceName ? t.monitoring.tile.service(firstName(monitoring.serviceName)) : t.monitoring.tile.noService}</p>
              <Link href="/pressespiegel" className="mt-2 inline-block text-sm font-semibold text-primary">{t.monitoring.tile.open} →</Link>
            </section>
            {warnings && <Warnings warnings={warnings} />}
            <section aria-labelledby="redaktion-tile">
              <h2 id="redaktion-tile" className="kicker">{d.redaktionTile}</h2>
              <ul className="mt-2 text-sm">
                {OPEN_STATUSES.map((s) => (
                  <li key={s}>
                    <Link href={`/redaktion?status=${s}`} className="flex justify-between border-b py-2 hover:underline hover:decoration-1 hover:underline-offset-4">
                      <span>{t.tasks.statuses[s]}</span>
                      <span className="font-medium tabular-nums">{docCounts[s] ?? 0}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/redaktion" className="mt-3 inline-block text-sm font-semibold text-primary">{d.toRedaktion} →</Link>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
