import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { selectedClientName } from "@/lib/domain/clients/current";
import { requireUser } from "@/lib/session";

export default async function DashboardPage() {
  const user = await requireUser();
  const clientName = await selectedClientName(prisma, user.selectedClientId);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t.dashboard.greeting(user.name.split(" ")[0] ?? user.name)}</h1>
      <p data-testid="client-filter" className="text-sm text-muted-foreground">
        {clientName ? t.dashboard.filterActive(clientName) : t.dashboard.filterAll}
      </p>
      <Card>
        <CardTitle>{t.dashboard.title}</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">{t.common.comingInPhase(1)}</p>
      </Card>
    </div>
  );
}
