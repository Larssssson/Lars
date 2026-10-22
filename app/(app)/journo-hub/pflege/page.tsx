import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { maintenanceList } from "@/lib/domain/journo/maintenance";
import { isCvd } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/time";

/** Wöchentliche Pflege für CVDs (BRIEFING 7.5): nur eine Liste, nichts geschieht automatisch. */
export default async function MaintenancePage() {
  const user = await requireUser();
  if (!isCvd(user)) notFound();
  const { duplicates, inactive } = await maintenanceList(prisma, new Date());
  const m = t.journo.maintenance;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{m.intro}</p>
      <Card className="p-4">
        <CardTitle>{m.duplicates}</CardTitle>
        {duplicates.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{m.none}</p> : (
          <ul className="mt-2 flex flex-col gap-1 text-sm" data-testid="maintenance-duplicates">
            {duplicates.map((g, i) => (
              <li key={i}>
                <span className="text-muted-foreground">{t.journo.import.reasons[g.reason]}: </span>
                {g.contacts.map((c, k) => <span key={c.id}>{k > 0 && ", "}<Link className="underline" href={`/journo-hub/${c.id}`}>{c.name}</Link>{c.media ? ` (${c.media})` : ""}</span>)}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="p-4">
        <CardTitle>{m.inactive}</CardTitle>
        {inactive.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{m.none}</p> : (
          <ul className="mt-2 flex flex-col gap-1 text-sm" data-testid="maintenance-inactive">
            {inactive.map((c) => <li key={c.id}><Link className="underline" href={`/journo-hub/${c.id}`}>{c.name}</Link>{c.media ? ` (${c.media})` : ""} · {m.lastActivity(formatDate(c.lastActivityAt))}</li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}
