import Link from "next/link";
import type { ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { listSelectableClients } from "@/lib/domain/clients/selection";
import { canOpenAdministration } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const [clients, unreadCount] = await Promise.all([
    listSelectableClients(prisma),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-20 focus:m-2 focus:rounded focus:bg-card focus:p-2">
        {t.nav.skipToContent}
      </a>
      <aside className="hidden w-60 shrink-0 border-r bg-sidebar md:block">
        <Link href="/" aria-label={t.common.appName} className="block px-7 pt-7 pb-6 font-serif text-[28px] leading-none font-semibold tracking-tight">
          im<em className="text-primary">press</em>
        </Link>
        <Sidebar showAdministration={canOpenAdministration(user)} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {env().DEMO_MODE === "true" && (
          <p role="note" className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-950 dark:bg-amber-900 dark:text-amber-50" data-testid="demo-banner">
            {t.auth.demoBanner}
          </p>
        )}
        <Header
          user={user}
          clients={clients}
          selectedClientId={user.selectedClientId}
          unreadCount={unreadCount}
        />
        <div className="border-b md:hidden">
          <Sidebar showAdministration={canOpenAdministration(user)} horizontal />
        </div>
        <main id="main" className="flex-1 px-4 py-6 md:px-10 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
