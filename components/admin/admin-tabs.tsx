"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/verwaltung/nutzer", label: t.admin.tabs.users },
  { href: "/verwaltung/diensttypen", label: t.admin.tabs.shiftTypes },
  { href: "/verwaltung/darstellungsformen", label: t.admin.tabs.formats },
  { href: "/verwaltung/einstellungen", label: t.admin.tabs.settings },
  { href: "/verwaltung/integrationen", label: t.admin.tabs.integrations, adminOnly: true },
  { href: "/verwaltung/kennzahlen", label: t.admin.tabs.metrics, adminOnly: true },
  { href: "/verwaltung/protokoll", label: t.admin.tabs.audit },
];

/** Integrationen, KI und Kennzahlen nur für Admins (BRIEFING 3.1); die Seiten prüfen selbst. */
export function AdminTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label={t.admin.title} className="flex gap-1 overflow-x-auto border-b">
      {tabs.filter((tab) => isAdmin || !tab.adminOnly).map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}
            className={cn("-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm", active ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
