"use client";

import { useState, useTransition } from "react";
import { selectAction } from "@/app/(app)/pressespiegel/actions";
import { t } from "@/i18n";

/** Häkchen "Aufnehmen" pro Kunde (BRIEFING 7.6 Schritt 5). */
export function SelectToggle({ articleId, clientId, clientName, selected }: { articleId: string; clientId: string; clientName: string; selected: boolean }) {
  const [checked, setChecked] = useState(selected);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-1.5 text-sm font-medium">
      <input type="checkbox" className="size-4 accent-primary" checked={checked} disabled={pending}
        aria-label={`${t.monitoring.select} ${t.monitoring.forClient} ${clientName}`}
        onChange={(e) => {
          const next = e.currentTarget.checked;
          setChecked(next);
          start(async () => {
            const r = await selectAction(articleId, clientId, next);
            if (r?.error) {
              setChecked(!next);
              setError(r.error);
            }
          });
        }} />
      {t.monitoring.select}
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </label>
  );
}
