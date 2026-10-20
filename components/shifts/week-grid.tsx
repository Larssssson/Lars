import { t } from "@/i18n";
import type { weekView } from "@/lib/domain/shifts";
import { formatDayKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import { AssignShiftForm, RemoveShiftButton } from "./shift-cell-actions";

type Week = Awaited<ReturnType<typeof weekView>>;

/** Wochenansicht: eine Zeile pro Diensttyp, eine Spalte pro Tag (BRIEFING 7.8). */
export function WeekGrid({
  week,
  today,
  editable,
  users = [],
}: {
  week: Week;
  today: string;
  editable: boolean;
  users?: { id: string; name: string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] table-fixed text-sm">
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="w-40 px-3 py-2 text-left font-medium">{t.shifts.type}</th>
            {week.days.map((day) => (
              <th key={day} scope="col" className={cn("px-2 py-2 text-left font-medium", day === today && "text-foreground")}>
                {formatDayKey(day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {week.rows.map((row) => (
            <tr key={row.type.id} className="border-t align-top">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                {row.type.name}
                <span className="block text-xs font-normal text-muted-foreground">{row.type.defaultStart}–{row.type.defaultEnd}</span>
              </th>
              {row.cells.map((cell) => (
                <td key={cell.day} className={cn("px-2 py-2", cell.day === today && "bg-accent/40", !cell.allowed && "bg-muted/50")}>
                  {!cell.allowed ? (
                    <span className="text-muted-foreground" aria-hidden>{t.shifts.notAllowed}</span>
                  ) : (
                    <>
                      <ul className="flex flex-col gap-1">
                        {cell.entries.map((e) => (
                          <li key={e.id} className="flex items-center justify-between gap-1">
                            <span>{e.userName}</span>
                            {editable && <RemoveShiftButton shiftId={e.id} name={e.userName} />}
                          </li>
                        ))}
                      </ul>
                      {editable && (
                        <AssignShiftForm
                          shiftTypeId={row.type.id}
                          day={cell.day}
                          label={`${row.type.name}, ${formatDayKey(cell.day)}`}
                          users={users}
                        />
                      )}
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
