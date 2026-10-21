import type { ReactNode } from "react";
import { MonitoringTabs } from "@/components/monitoring/monitoring-tabs";
import { t } from "@/i18n";
import { requireUser } from "@/lib/session";

export default async function MonitoringLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.monitoring.title}</h1>
        <p className="text-sm text-muted-foreground">{t.monitoring.intro}</p>
      </div>
      <MonitoringTabs />
      {children}
    </div>
  );
}
