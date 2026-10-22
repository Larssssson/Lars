import Link from "next/link";
import { CopyWeekButton } from "@/components/shifts/copy-week-button";
import { WeekGrid } from "@/components/shifts/week-grid";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { weekView } from "@/lib/domain/shifts";
import { canManageShifts } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";
import { addDays, dateKey, formatDayKey } from "@/lib/time";

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ woche?: string }> }) {
  const user = await requireUser();
  const { woche } = await searchParams;
  const today = dateKey(new Date());
  const anchor = woche && /^\d{4}-\d{2}-\d{2}$/.test(woche) ? woche : today;
  const week = await weekView(prisma, anchor);
  const editable = canManageShifts(user);
  const users = editable ? await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];
  const prev = addDays(week.monday, -7);
  const next = addDays(week.monday, 7);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.shifts.title}</h1>
          <p className="text-sm text-muted-foreground">{t.shifts.week(formatDayKey(week.monday), formatDayKey(addDays(week.monday, 6)))}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link href={`/dienstplan?woche=${prev}`}>{t.shifts.previousWeek}</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/dienstplan">{t.shifts.thisWeek}</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href={`/dienstplan?woche=${next}`}>{t.shifts.nextWeek}</Link></Button>
          {editable && <CopyWeekButton fromDay={week.monday} toDay={next} />}
        </div>
      </div>
      {!editable && <p className="text-sm text-muted-foreground">{t.shifts.readOnlyHint}</p>}
      <WeekGrid week={week} today={today} editable={editable} users={users} />
    </div>
  );
}
