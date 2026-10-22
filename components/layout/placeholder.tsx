import { Card } from "@/components/ui/card";
import { t } from "@/i18n";

/** Platzhalter für Bereiche, die in einer späteren Phase gebaut werden. */
export function Placeholder({ title, phase, clientName }: { title: string; phase: number; clientName: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p data-testid="client-filter" className="text-sm text-muted-foreground">
        {clientName ? t.dashboard.filterActive(clientName) : t.dashboard.filterAll}
      </p>
      <Card>
        <p className="text-sm text-muted-foreground">{t.common.comingInPhase(phase)}</p>
      </Card>
    </div>
  );
}
