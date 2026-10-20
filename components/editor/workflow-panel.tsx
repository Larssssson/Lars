"use client";

import { useState } from "react";
import {
  clientAgreedAction,
  decideAction,
  dispatchAction,
  dispatchTextAction,
  importWordAction,
  reopenAction,
  requestApprovalAction,
  withdrawAction,
} from "@/app/(app)/aufgaben/[id]/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { t } from "@/i18n";

type Option = { id: string; name: string };

/** Freigabe anfragen mit vorbelegten Freigebern und Rückfrage ohne Prüfung (BRIEFING 6.3, 6.4). */
export function RequestApprovalForm({ taskId, approvers, preselected }: { taskId: string; approvers: Option[]; preselected: string[] }) {
  const a = t.approvals;
  const [selected, setSelected] = useState<string[]>(preselected);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (confirmWithoutCheck: boolean) => {
    setPending(true);
    const result = await requestApprovalAction(taskId, { approverIds: selected, note, confirmWithoutCheck });
    setPending(false);
    if (result.needsConfirm) {
      if (window.confirm(a.confirmWithoutCheck)) await submit(true);
      return;
    }
    setError(result.error ?? null);
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void submit(false); }}>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium">{a.approvers}</legend>
        {approvers.map((approver) => (
          <Checkbox
            key={approver.id}
            label={approver.name}
            checked={selected.includes(approver.id)}
            onChange={(e) => {
              const checked = e.currentTarget.checked;
              setSelected((s) => (checked ? [...s, approver.id] : s.filter((x) => x !== approver.id)));
            }}
          />
        ))}
      </fieldset>
      <Field label={a.note} htmlFor="approval-note" optional={t.tasks.optional}>
        <Textarea id="approval-note" value={note} onChange={(e) => setNote(e.currentTarget.value)} className="min-h-16" />
      </Field>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending || selected.length === 0}>{a.send}</Button>
    </form>
  );
}

export function WithdrawButton({ taskId }: { taskId: string }) {
  return (
    <ActionForm action={withdrawAction.bind(null, taskId)}>
      <SubmitButton size="sm" variant="outline">{t.approvals.withdraw}</SubmitButton>
    </ActionForm>
  );
}

/** Entscheidung des Freigebers: freigeben oder Änderungen mit Pflichtkommentar (BRIEFING 6.4). */
export function DecisionForms({ taskId, selfApproval }: { taskId: string; selfApproval: boolean }) {
  const a = t.approvals;
  return (
    <div className="flex flex-col gap-4">
      <ActionForm action={decideAction.bind(null, taskId, "FREIGEGEBEN")} className="flex flex-col gap-1">
        <SubmitButton>{selfApproval ? a.selfApprove : a.approve}</SubmitButton>
        {selfApproval && <p className="text-xs text-muted-foreground">{a.selfApproveHint}</p>}
      </ActionForm>
      <ActionForm action={decideAction.bind(null, taskId, "AENDERUNGEN")} className="flex flex-col gap-2">
        <Field label={a.changesNote} htmlFor="changes-note" hint={a.changesNoteHint}>
          <Textarea id="changes-note" name="note" required className="min-h-16" />
        </Field>
        <SubmitButton variant="outline">{a.requestChanges}</SubmitButton>
      </ActionForm>
    </div>
  );
}

export function ReopenButton({ taskId, label }: { taskId: string; label: string }) {
  return (
    <ActionForm action={reopenAction.bind(null, taskId)} confirm={t.documents.confirmReopen}>
      <SubmitButton size="sm" variant="outline">{label}</SubmitButton>
    </ActionForm>
  );
}

export function ImportWordForm({ taskId, label, confirm }: { taskId: string; label: string; confirm?: string }) {
  return (
    <ActionForm action={importWordAction.bind(null, taskId)} confirm={confirm} className="flex flex-col gap-2">
      <Field label={t.documents.wordFile} htmlFor={`import-${taskId}`} hint={t.documents.importHint}>
        <Input id={`import-${taskId}`} name="datei" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required className="h-auto py-1.5" />
      </Field>
      <SubmitButton size="sm" variant="outline" className="self-start">{label}</SubmitButton>
    </ActionForm>
  );
}

export function ClientAgreedButton({ taskId }: { taskId: string }) {
  return (
    <ActionForm action={clientAgreedAction.bind(null, taskId)}>
      <SubmitButton size="sm">{t.dispatch.clientAgreed}</SubmitButton>
    </ActionForm>
  );
}

/**
 * Versenden (BRIEFING 6.5): Ziel wählen, exportieren oder kopieren, außerhalb verschicken,
 * Empfänger und Kanal eintragen und "Versendet" bestätigen.
 */
export function DispatchForm({ taskId, title, clientHasLogo }: { taskId: string; title: string; clientHasLogo: boolean }) {
  const s = t.dispatch;
  const e = t.documents.export;
  const [template, setTemplate] = useState<"RP" | "KUNDE">("RP");
  const [copied, setCopied] = useState(false);
  const exportUrl = (art: "docx" | "pdf") => `/api/dokumente/${taskId}/export?art=${art}&vorlage=${template}`;

  return (
    <ActionForm action={dispatchAction.bind(null, taskId)} className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{s.intro}</p>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium">{s.target}</legend>
        {(Object.keys(s.targets) as (keyof typeof s.targets)[]).map((key, i) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input type="radio" name="target" value={key} defaultChecked={i === 0} className="accent-primary" /> {s.targets[key]}
          </label>
        ))}
      </fieldset>
      <Field label={e.template} htmlFor="dispatch-template">
        <Select id="dispatch-template" name="template" value={template} onChange={(ev) => setTemplate(ev.currentTarget.value as "RP" | "KUNDE")}>
          <option value="RP">{e.rp}</option>
          <option value="KUNDE" disabled={!clientHasLogo}>{clientHasLogo ? e.client : `${e.client} (${e.clientUnavailable})`}</option>
        </Select>
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline"><a href={exportUrl("docx")} download>{e.word}</a></Button>
        <Button asChild size="sm" variant="outline"><a href={exportUrl("pdf")} download>{e.pdf}</a></Button>
        <Button type="button" size="sm" variant="outline" onClick={async () => {
          await navigator.clipboard.writeText(await dispatchTextAction(taskId));
          setCopied(true);
        }}>
          {copied ? s.copied : s.copyText}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={async () => {
          const text = (await dispatchTextAction(taskId)).slice(0, 1800);
          window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
        }}>
          {s.mailDraft}
        </Button>
      </div>
      <Field label={s.recipients} htmlFor="dispatch-recipients"><Input id="dispatch-recipients" name="recipients" required /></Field>
      <Field label={s.channel} htmlFor="dispatch-channel"><Input id="dispatch-channel" name="channel" required placeholder={s.channelPlaceholder} /></Field>
      <SubmitButton>{s.confirm}</SubmitButton>
    </ActionForm>
  );
}
