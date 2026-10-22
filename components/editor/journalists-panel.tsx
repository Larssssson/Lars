"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { journalistSuggestionsAction, toggleBookmarkAction, type SuggestionsResult } from "@/app/(app)/journo-hub/actions";
import { ContactStatusBadge } from "@/components/journo/status-badge";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

/**
 * Reiter Journalisten (BRIEFING 7.5): immer verfügbar, auch beim Schreiben. Passende Kontakte mit
 * Begründung, Öffnen, Anfragen, Vormerken; Sperrfrist oben.
 */
export function JournalistsPanel({ taskId, onBookmarkChange }: { taskId: string; onBookmarkChange: () => void }) {
  const [result, setResult] = useState<SuggestionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const e = t.journo.editor;

  useEffect(() => {
    let cancelled = false;
    void journalistSuggestionsAction(taskId).then((r) => {
      if (cancelled) return;
      if ("suggestions" in r) setResult(r);
      else setError(r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (error) return <p role="alert" className="text-destructive">{error}</p>;
  if (!result) return <p className="text-muted-foreground">{t.ai.generating}</p>;

  return (
    <div className="flex flex-col gap-3" data-testid="journalists-panel">
      {result.embargo && <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">{e.embargo(result.embargo)}</p>}
      <p className="text-xs font-medium text-muted-foreground">{e.title}{result.aiOrdered ? ` · ${e.aiOrdered}` : ""}</p>
      {result.suggestions.length === 0 ? <p className="text-muted-foreground">{e.none}</p> : (
        <ul className="flex flex-col gap-3" data-testid="journalist-suggestions">
          {result.suggestions.map((s) => (
            <li key={s.id} className="flex flex-col gap-1 rounded-md border p-2">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.name}</span>
                <ContactStatusBadge status={s.status} />
              </span>
              <span className="text-xs text-muted-foreground">{[s.media, s.desk].filter(Boolean).join(" · ")}</span>
              <span className="text-xs">{s.reason}</span>
              <span className="flex flex-wrap gap-1.5">
                <Button asChild size="sm" variant="outline" className="h-7"><Link href={`/journo-hub/${s.id}?aufgabe=${taskId}`}>{e.open}</Link></Button>
                <Button asChild size="sm" variant="ghost" className="h-7"><Link href={`/journo-hub/${s.id}?aufgabe=${taskId}#anfragen`}>{e.request}</Link></Button>
                <Button size="sm" variant={s.bookmarked ? "default" : "outline"} className="h-7" disabled={pending} aria-pressed={s.bookmarked}
                  onClick={() => start(async () => {
                    const now = await toggleBookmarkAction(taskId, s.id);
                    setResult((r) => r && { ...r, suggestions: r.suggestions.map((x) => (x.id === s.id ? { ...x, bookmarked: now } : x)) });
                    onBookmarkChange();
                  })}>
                  {s.bookmarked ? e.bookmarked : e.bookmark}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
