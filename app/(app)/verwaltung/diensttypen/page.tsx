import { ShiftTypeForm } from "@/components/admin/admin-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { canManageShifts } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";

export default async function ShiftTypesPage() {
  const user = await requireUser();
  const types = await prisma.shiftType.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const manage = canManageShifts(user);
  return (
    <div className="flex flex-col gap-5">
      {types.map((type) => (
        <Card key={type.id}>
          <CardTitle className="mb-3">{type.name}</CardTitle>
          {manage ? (
            <ShiftTypeForm id={type.id} values={type} />
          ) : (
            <p className="text-sm">{type.defaultStart}–{type.defaultEnd} · {type.weekdays.map((d) => t.shifts.weekdayShort[d - 1]).join(", ")}</p>
          )}
        </Card>
      ))}
      {manage && (
        <Card>
          <CardTitle className="mb-3">{t.shifts.types.add}</CardTitle>
          <ShiftTypeForm />
        </Card>
      )}
    </div>
  );
}
