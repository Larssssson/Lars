"use client";

import { createFormatAction, updateFormatAction } from "@/app/(app)/verwaltung/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { t } from "@/i18n";

type Values = { name: string; blocks: string; rulesText: string; sharePointFolder: string };

export function FormatForm({ id, values, folders }: { id?: string; values?: Values; folders: string[] }) {
  const f = t.formats;
  const prefix = id ?? "neu";
  return (
    <ActionForm action={id ? updateFormatAction.bind(null, id) : createFormatAction} className="grid gap-3 sm:grid-cols-2">
      <Field label={f.name} htmlFor={`f-name-${prefix}`}><Input id={`f-name-${prefix}`} name="name" required defaultValue={values?.name} /></Field>
      <Field label={f.folder} htmlFor={`f-folder-${prefix}`}>
        <Select id={`f-folder-${prefix}`} name="sharePointFolder" defaultValue={values?.sharePointFolder ?? folders[0]}>
          {folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
        </Select>
      </Field>
      <Field label={f.blocks} htmlFor={`f-blocks-${prefix}`} hint={f.blocksHint}>
        <Textarea id={`f-blocks-${prefix}`} name="blocks" required defaultValue={values?.blocks} className="min-h-28 font-mono text-xs" />
      </Field>
      <Field label={f.rulesText} htmlFor={`f-rules-${prefix}`} optional={t.tasks.optional}>
        <Textarea id={`f-rules-${prefix}`} name="rulesText" defaultValue={values?.rulesText} className="min-h-28" />
      </Field>
      <div className="sm:col-span-2"><SubmitButton variant={id ? "outline" : "default"}>{id ? f.save : f.add}</SubmitButton></div>
    </ActionForm>
  );
}
