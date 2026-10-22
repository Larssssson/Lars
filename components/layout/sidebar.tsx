"use client";

import { CalendarDays, FileText, LayoutDashboard, Newspaper, Settings, Users, Building2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: t.nav.dashboard, icon: LayoutDashboard },
  { href: "/redaktion", label: t.nav.redaktion, icon: FileText },
  { href: "/pressespiegel", label: t.nav.pressespiegel, icon: Newspaper },
  { href: "/journo-hub", label: t.nav.journoHub, icon: Users },
  { href: "/kunden", label: t.nav.kunden, icon: Building2 },
  { href: "/dienstplan", label: t.nav.dienstplan, icon: CalendarDays },
] as const;

/** Linke Navigation (BRIEFING 4); Verwaltung nur für CVD und Admin (DECISIONS D-021). */
export function Sidebar({ showAdministration, horizontal = false }: { showAdministration: boolean; horizontal?: boolean }) {
  const pathname = usePathname();
  const all = showAdministration
    ? [...items, { href: "/verwaltung", label: t.nav.verwaltung, icon: Settings }]
    : items;
  return (
    <nav aria-label={t.nav.label} className={cn("flex gap-1 p-3", horizontal ? "flex-row overflow-x-auto p-2" : "flex-col")}>
      {all.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              active && "bg-accent text-accent-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
