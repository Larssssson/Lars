import type { ReactNode } from "react";
import { JournoTabs } from "@/components/journo/journo-tabs";
import { t } from "@/i18n";
import { isCvd } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";

export default async function JournoLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.journo.title}</h1>
        <p className="text-sm text-muted-foreground">{t.journo.intro}</p>
      </div>
      <JournoTabs showMaintenance={isCvd(user)} />
      {children}
    </div>
  );
}
