import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { t } from "@/i18n";
import { canOpenAdministration } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";

/** Verwaltung nur für CVD und Admin (BRIEFING 4); die Prüfung gilt für alle Unterseiten. */
export default async function AdministrationLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  if (!canOpenAdministration(user)) notFound();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t.admin.title}</h1>
      <AdminTabs />
      {children}
    </div>
  );
}
