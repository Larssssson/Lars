import Link from "next/link";
import type { ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
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
      <aside className="hidden w-56 shrink-0 border-r bg-sidebar md:block">
        <Link href="/" className="block px-6 pt-5 pb-3 text-xl font-bold tracking-tight">
          {t.common.appName}
        </Link>
        <Sidebar showAdministration={canOpenAdministration(user)} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          user={user}
          clients={clients}
          selectedClientId={user.selectedClientId}
          unreadCount={unreadCount}
        />
        <div className="border-b md:hidden">
          <Sidebar showAdministration={canOpenAdministration(user)} horizontal />
        </div>
        <main id="main" className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
