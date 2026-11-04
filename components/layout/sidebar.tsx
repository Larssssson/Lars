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
    <nav aria-label={t.nav.label} className={cn("flex gap-0.5", horizontal ? "flex-row overflow-x-auto p-2" : "flex-col px-4")}>
      {all.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-[14.5px] font-medium text-muted-foreground transition-colors hover:text-foreground",
              active && "font-semibold text-foreground",
              // schmaler Strich links markiert den aktiven Bereich, auf dem Telefon darunter
              active && (horizontal ? "after:absolute after:inset-x-3 after:-bottom-2 after:h-0.5 after:rounded after:bg-primary" : "before:absolute before:top-2 before:bottom-2 before:-left-4 before:w-[3px] before:rounded-r before:bg-primary"),
            )}
          >
            <Icon className="size-[18px]" strokeWidth={1.6} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
