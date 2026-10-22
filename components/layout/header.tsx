import { Bell, Plus, Search } from "lucide-react";
import Link from "next/link";
import { signOutAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { ClientSelect } from "./client-select";

type Props = {
  user: { name: string; role: "REDAKTEUR" | "CVD"; isAdmin: boolean };
  clients: { id: string; name: string }[];
  selectedClientId: string | null;
  unreadCount: number;
};

/** Feste Kopfzeile (BRIEFING 4): Kundenauswahl, Suche, Neue Aufgabe, Glocke, Profil. */
export function Header({ user, clients, selectedClientId, unreadCount }: Props) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
      <ClientSelect key={selectedClientId ?? "alle"} clients={clients} selectedId={selectedClientId} />
      <form action="/suche" role="search" className="relative hidden flex-1 md:block md:max-w-md">
        <label htmlFor="global-search" className="sr-only">
          {t.header.search}
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id="global-search"
          name="q"
          type="search"
          placeholder={t.header.searchPlaceholder}
          className="h-9 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm"
        />
      </form>
      <div className="ml-auto flex items-center gap-2">
        <Button asChild size="sm">
          <Link href="/aufgaben/neu">
            <Plus aria-hidden />
            <span className="hidden sm:inline">{t.header.newTask}</span>
          </Link>
        </Button>
        <Button asChild variant="ghost" size="icon" className="relative">
          <Link href="/benachrichtigungen" aria-label={`${t.header.notifications}: ${t.header.unread(unreadCount)}`}>
            <Bell aria-hidden />
            {unreadCount > 0 && (
              <span
                data-testid="unread-count"
                className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-destructive px-1 text-center text-xs font-semibold text-destructive-foreground"
              >
                {unreadCount}
              </span>
            )}
          </Link>
        </Button>
        <details className="relative">
          <summary className="flex h-9 cursor-pointer list-none items-center rounded-md px-3 text-sm font-medium hover:bg-accent">
            <span className="sr-only">{t.header.profile}: </span>
            {user.name}
          </summary>
          <div className="absolute right-0 mt-1 w-56 rounded-md border bg-card p-1 shadow-md">
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {t.common.roles[user.role]}
              {user.isAdmin ? ` · ${t.common.admin}` : ""}
            </p>
            <Link href="/profil" className="block rounded px-3 py-2 text-sm hover:bg-accent">
              {t.header.profileSettings}
            </Link>
            <Link href="/profil#push" className="block rounded px-3 py-2 text-sm hover:bg-accent">
              {t.header.setupPush}
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="w-full rounded px-3 py-2 text-left text-sm hover:bg-accent">
                {t.header.signOut}
              </button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
