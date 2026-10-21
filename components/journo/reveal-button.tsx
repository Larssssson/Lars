"use client";

import { useState, useTransition } from "react";
import { revealAction } from "@/app/(app)/journo-hub/actions";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

/** Eine verdeckte Angabe aufdecken; der Server prüft das Recht und protokolliert (BRIEFING 7.5, 11). */
export function RevealButton({ detailId, masked, taskId, label }: { detailId: string; masked: string; taskId: string | null; label: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono text-sm" data-testid={`detail-${label}`}>{value ?? masked}</span>
      {!value && (
        <Button type="button" size="sm" variant="outline" className="h-7" disabled={pending}
          onClick={() => start(async () => {
            const r = await revealAction(detailId, taskId);
            if (r.value) setValue(r.value);
            setError(r.error ?? null);
          })}>
          {t.journo.reveal}
        </Button>
      )}
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
