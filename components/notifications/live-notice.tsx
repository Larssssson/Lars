"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { t } from "@/i18n";

type Item = { id: string; kind: string; title: string; link: string | null };

const POLL_MS = 20_000;
const SHOW_MS = 12_000;

/**
 * Hinweis oben im Fenster, wenn man erwähnt wird oder eine Aufgabe bekommt (DECISIONS D-128).
 * Fragt alle 20 Sekunden nach; die Glocke zählt danach mit. Kein Push (Grundsatz 7).
 */
export function LiveNotice({ since: initialSince }: { since: string }) {
  const router = useRouter();
  const since = useRef<string>(initialSince);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/benachrichtigungen/neu?seit=${encodeURIComponent(since.current)}`, { cache: "no-store" });
        if (!response.ok || stopped) return;
        const data = (await response.json()) as { now: string; items: Item[] };
        since.current = data.now;
        if (data.items.length) {
          setItems((current) => [...current, ...data.items].slice(-3));
          router.refresh();
        }
      } catch {
        // offline: beim nächsten Mal
      }
    };
    // erster Abruf erst nach 20 Sekunden: die Startzeit kommt vom Server, beim Laden ist nichts zu tun
    const timer = setInterval(() => document.visibilityState === "visible" && void poll(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [router]);

  useEffect(() => {
    if (!items.length) return;
    const timer = setTimeout(() => setItems((current) => current.slice(1)), SHOW_MS);
    return () => clearTimeout(timer);
  }, [items]);

  if (!items.length) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
      {items.map((item) => (
        <div key={item.id} role="status" data-testid="live-notice" className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm shadow-lg">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="kicker !text-primary">{item.kind === "MENTION" ? t.notifications.live.mention : t.notifications.live.assigned}</p>
            {item.link ? (
              <Link href={item.link} className="mt-0.5 block font-medium hover:underline" onClick={() => setItems((c) => c.filter((i) => i.id !== item.id))}>{item.title}</Link>
            ) : (
              <p className="mt-0.5 font-medium">{item.title}</p>
            )}
          </div>
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t.notifications.live.close} onClick={() => setItems((c) => c.filter((i) => i.id !== item.id))}>×</button>
        </div>
      ))}
    </div>
  );
}
