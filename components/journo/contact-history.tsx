"use client";

import { addContactEventAction, deleteContactEventAction } from "@/app/(app)/journo-hub/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { t } from "@/i18n";
import { MANUAL_KINDS } from "@/lib/domain/journo/kinds";

export type ContactEventView = { id: string; kind: string; at: string; userName: string | null; clientName: string | null; taskId: string | null; taskTitle: string | null; note: string | null; automatic: boolean; mayDelete: boolean };

/** Kontakthistorie auf der Kontaktseite: Liste und Eintragen (DECISIONS D-134). */
export function ContactHistory({ journalistId, events, clients, defaultClientId, today }: { journalistId: string; events: ContactEventView[]; clients: { id: string; name: string }[]; defaultClientId: string | null; today: string }) {
  const h = t.journo.contactHistory;
  return (
    <div className="flex flex-col gap-3">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{h.none}</p>
      ) : (
        <ul className="flex flex-col divide-y text-sm" data-testid="contact-events">
          {events.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-2 py-1.5">
              <span>
                <span className="text-muted-foreground">{e.at}</span> · {h.entry(h.kinds[e.kind] ?? e.kind, e.userName ?? "–")}
                {e.clientName ? <span className="text-muted-foreground"> · {e.clientName}</span> : null}
                {e.taskId && e.taskTitle ? <> · <a className="underline" href={`/aufgaben/${e.taskId}`}>{e.taskTitle}</a></> : null}
                {e.automatic ? <span className="text-muted-foreground"> · {h.automatic}</span> : null}
                {e.note ? <span className="block text-xs text-muted-foreground">{e.note}</span> : null}
              </span>
              {e.mayDelete && (
                <ActionForm action={deleteContactEventAction.bind(null, journalistId, e.id)}>
                  <SubmitButton size="sm" variant="ghost" className="h-7">{h.delete}</SubmitButton>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">{h.add}</summary>
        <ActionForm action={addContactEventAction.bind(null, journalistId)} className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label={h.kind} htmlFor="ce-kind">
            <Select id="ce-kind" name="kind" defaultValue="TELEFONAT">
              {MANUAL_KINDS.map((k) => <option key={k} value={k}>{h.kinds[k]}</option>)}
            </Select>
          </Field>
          <Field label={h.date} htmlFor="ce-at"><Input id="ce-at" name="at" type="date" required defaultValue={today} max={today} /></Field>
          <Field label={h.client} htmlFor="ce-client">
            <Select id="ce-client" name="clientId" defaultValue={defaultClientId ?? ""}>
              <option value="">{h.noClient}</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label={h.note} htmlFor="ce-note" className="sm:col-span-3"><Input id="ce-note" name="note" maxLength={300} /></Field>
          <div className="sm:col-span-3"><SubmitButton size="sm">{h.save}</SubmitButton></div>
        </ActionForm>
      </details>
    </div>
  );
}
