"use client";

import { useState, useTransition } from "react";
import { selectClientAction } from "@/app/(app)/actions";
import { t } from "@/i18n";

type Option = { id: string; name: string };

/**
 * Kundenauswahl der Kopfzeile; gilt für alle Bereiche und wird pro Nutzer gespeichert.
 * Der Aufrufer setzt key={selectedId}, damit ein neuer Wert vom Server den Zustand ersetzt.
 */
export function ClientSelect({ clients, selectedId }: { clients: Option[]; selectedId: string | null }) {
  const [value, setValue] = useState(selectedId ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <label htmlFor="client-select" className="sr-only">
        {t.header.clientSelect}
      </label>
      <select
        id="client-select"
        name="clientId"
        value={value}
        disabled={pending}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setValue(next);
          const data = new FormData();
          data.set("clientId", next);
          startTransition(() => selectClientAction(data));
        }}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
      >
        <option value="">{t.common.allClients}</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
    </div>
  );
}
