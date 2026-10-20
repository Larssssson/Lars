"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/verwaltung/nutzer", label: t.admin.tabs.users },
  { href: "/verwaltung/diensttypen", label: t.admin.tabs.shiftTypes },
  { href: "/verwaltung/darstellungsformen", label: t.admin.tabs.formats },
  { href: "/verwaltung/protokoll", label: t.admin.tabs.audit },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label={t.admin.title} className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
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
