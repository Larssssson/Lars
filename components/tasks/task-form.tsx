"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createTaskAction } from "@/app/(app)/aufgaben/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { t } from "@/i18n";
import type { DueOption } from "@/lib/domain/tasks/rules";

type Option = { id: string; name: string };

export type TaskFormProps = {
  clientId: string | null;
  clients: Option[];
  formats: { key: string; name: string }[];
  owners: Option[];
  selfId: string;
  canAssignOthers: boolean;
  projects: Option[];
  services: Option[];
  approvers: Option[];
  /** Schnellwahl als Wert für datetime-local, in Berliner Zeit vorberechnet */
  dueOptions: Record<DueOption, string>;
  defaultDue: string;
};

/** Formular "Neue Aufgabe" in der Reihenfolge aus BRIEFING 6.1. */
export function TaskForm(props: TaskFormProps) {
  const router = useRouter();
  const [type, setType] = useState<"DOKUMENT" | "AUFGABE">("DOKUMENT");
  const [due, setDue] = useState(props.defaultDue);
  const f = t.tasks.fields;

  return (
    <ActionForm action={createTaskAction} className="flex max-w-2xl flex-col gap-5">
      <Field label={f.client} htmlFor="clientId">
        <Select
          id="clientId"
          name="clientId"
          required
          value={props.clientId ?? ""}
          onChange={(e) => router.replace(`/aufgaben/neu?kunde=${e.currentTarget.value}`)}
        >
          <option value="" disabled>
            {t.tasks.choose}
          </option>
          {props.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={f.category} htmlFor="category">
        <Select id="category" name="category" required defaultValue="">
          <option value="" disabled>
            {t.tasks.choose}
          </option>
          {Object.entries(t.tasks.categories).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">{f.type}</legend>
        <div className="flex gap-4">
          {(["DOKUMENT", "AUFGABE"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input type="radio" name="type" value={value} checked={type === value} onChange={() => setType(value)} className="accent-primary" />
              {t.tasks.types[value]}
            </label>
          ))}
        </div>
        {type === "DOKUMENT" && (
          <Field label={f.format} htmlFor="format">
            <Select id="format" name="format" required defaultValue="">
              <option value="" disabled>
                {t.tasks.choose}
              </option>
              {props.formats.map((format) => (
                <option key={format.key} value={format.key}>
                  {format.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </fieldset>

      <Field label={f.title} htmlFor="title">
        <Input id="title" name="title" required maxLength={200} />
      </Field>

      <Field label={f.owner} htmlFor="ownerId" hint={props.canAssignOthers ? undefined : t.tasks.ownerOnlySelf}>
        <Select id="ownerId" name="ownerId" defaultValue={props.selfId} disabled={!props.canAssignOthers}>
          {props.owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.id === props.selfId ? t.tasks.ownerSelf(o.name) : o.name}
            </option>
          ))}
        </Select>
        {!props.canAssignOthers && <input type="hidden" name="ownerId" value={props.selfId} />}
      </Field>

      <Field label={f.due} htmlFor="dueAt">
        <div className="flex flex-col gap-2">
          <Input id="dueAt" name="dueAt" type="datetime-local" required value={due} onChange={(e) => setDue(e.currentTarget.value)} />
          <div role="group" aria-label={t.tasks.dueQuickLabel} className="flex flex-wrap gap-2">
            {(Object.keys(props.dueOptions) as DueOption[]).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={due === props.dueOptions[key] ? "default" : "outline"}
                aria-pressed={due === props.dueOptions[key]}
                onClick={() => setDue(props.dueOptions[key])}
              >
                {t.tasks.dueOptions[key]}
              </Button>
            ))}
          </div>
        </div>
      </Field>

      <details className="rounded-md border p-4">
        <summary className="cursor-pointer text-sm font-medium">{t.tasks.optional}</summary>
        <div className="mt-4 flex flex-col gap-4">
          <Field label={f.embargo} htmlFor="embargoAt">
            <Input id="embargoAt" name="embargoAt" type="datetime-local" />
          </Field>
          <Field label={f.project} htmlFor="projectId">
            <Select id="projectId" name="projectId" defaultValue="">
              <option value="">{t.tasks.none}</option>
              {props.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={f.agreedService} htmlFor="agreedServiceId">
            <Select id="agreedServiceId" name="agreedServiceId" defaultValue="">
              <option value="">{t.tasks.none}</option>
              {props.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={f.preferredApprover} htmlFor="preferredApproverId">
            <Select id="preferredApproverId" name="preferredApproverId" defaultValue="">
              <option value="">{t.tasks.none}</option>
              {props.approvers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={f.description} htmlFor="description">
            <Textarea id="description" name="description" maxLength={5000} />
          </Field>
          <Field label={f.attachments} htmlFor="attachments">
            <Input id="attachments" name="attachments" type="file" multiple className="h-auto py-1.5" />
          </Field>
        </div>
      </details>

      <div className="flex gap-3">
        <SubmitButton>{t.tasks.save}</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          {t.tasks.cancel}
        </Button>
      </div>
    </ActionForm>
  );
}
