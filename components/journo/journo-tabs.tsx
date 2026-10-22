"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

/** Reiter des Journo Hub; Pflege nur für CVDs. */
export function JournoTabs({ showMaintenance }: { showMaintenance: boolean }) {
  const pathname = usePathname();
  const j = t.journo.tabs;
  const tabs = [
    { href: "/journo-hub", label: j.contacts, exact: true },
    { href: "/journo-hub/medien", label: j.media },
    { href: "/journo-hub/anfragen", label: j.requests },
    { href: "/journo-hub/import", label: j.import },
    ...(showMaintenance ? [{ href: "/journo-hub/pflege", label: j.maintenance }] : []),
  ];
  return (
    <nav aria-label={t.journo.title} className="flex flex-wrap gap-1 border-b">
      {tabs.map((tab) => {
        const active = "exact" in tab ? pathname === tab.href || /^\/journo-hub\/(neu|[0-9a-f-]{36})/.test(pathname) : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", active ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
