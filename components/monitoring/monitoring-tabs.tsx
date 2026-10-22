"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

export function MonitoringTabs() {
  const pathname = usePathname();
  const m = t.monitoring.tabs;
  const tabs = [
    { href: "/pressespiegel", label: m.today },
    { href: "/pressespiegel/alle", label: m.all },
    { href: "/pressespiegel/import", label: m.import },
  ];
  return (
    <nav aria-label={t.monitoring.title} className="flex flex-wrap gap-1 border-b">
      {tabs.map((tab) => {
        const active = tab.href === "/pressespiegel" ? pathname === tab.href : pathname.startsWith(tab.href);
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
