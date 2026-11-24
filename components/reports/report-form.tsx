"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createReportAction, updateReportAction } from "@/app/(app)/reporting/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { t } from "@/i18n";
import { TEMPLATES, type ReportBlock } from "@/lib/domain/reports/templates";
import { cn } from "@/lib/utils";

type Template = keyof typeof TEMPLATES;
export type ReportFormValues = {
  clientId: string;
  title: string;
  template: Template;
  from: string;
  to: string;
  blocks: string[];
  clientAliases: string[];
  competitors: string[];
  tier1: string[];
  tier2: string[];
  excludePaid: boolean;
  topicFilter: string[];
  commentary: string;
};

/** Neues Reporting oder Einstellungen eines bestehenden (DECISIONS D-133). */
export function ReportForm({ reportId, clients, values, hasFile }: { reportId?: string; clients: { id: string; name: string }[]; values: ReportFormValues; hasFile?: boolean }) {
  const f = t.reports.form;
  const router = useRouter();
  const [template, setTemplate] = useState<Template>(values.template);
  const [blocks, setBlocks] = useState<string[]>(values.blocks);
  const editing = Boolean(reportId);
  const action = reportId ? updateReportAction.bind(null, reportId) : createReportAction;

  const chooseTemplate = (next: Template) => {
    setTemplate(next);
    if (!editing) setBlocks(TEMPLATES[next].defaults);
  };
  const ordered: ReportBlock[] = TEMPLATES[template].order;

  return (
    <ActionForm action={action} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {editing ? (
          <input type="hidden" name="clientId" value={values.clientId} />
        ) : (
          <Field label={f.client} htmlFor="r-client">
            <Select id="r-client" name="clientId" required defaultValue={values.clientId} onChange={(e) => router.replace(`/reporting/neu?kunde=${e.currentTarget.value}`)}>
              <option value="">–</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label={f.title} htmlFor="r-title"><Input id="r-title" name="title" defaultValue={values.title} placeholder={f.titlePlaceholder} /></Field>
        <Field label={f.from} htmlFor="r-from"><Input id="r-from" name="from" type="date" required defaultValue={values.from} /></Field>
        <Field label={f.to} htmlFor="r-to"><Input id="r-to" name="to" type="date" required defaultValue={values.to} /></Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{f.template}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(TEMPLATES) as Template[]).map((key) => (
            <label key={key} className={cn("flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm", template === key ? "border-primary bg-accent" : "hover:bg-muted")}>
              <span className="flex items-center gap-2 font-serif text-lg font-medium">
                <input type="radio" name="template" value={key} checked={template === key} onChange={() => chooseTemplate(key)} className="accent-primary" />
                {t.reports.templates[key].name}
              </span>
              <span className="text-xs text-muted-foreground">{t.reports.templates[key].text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label={editing && hasFile ? f.newFile : f.file} htmlFor="r-file" hint={f.fileHint}>
        <Input id="r-file" name="file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required={!editing} />
      </Field>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">{f.blocks}</legend>
        <p className="mb-2 text-xs text-muted-foreground">{f.blocksHint}</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {ordered.map((block) => (
            <label key={block} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="blocks"
                value={block}
                checked={blocks.includes(block)}
                onChange={(e) => {
                  const on = e.currentTarget.checked;
                  setBlocks((cur) => (on ? [...cur, block] : cur.filter((b) => b !== block)));
                }}
                className="accent-primary"
              />
              {t.reports.blocks[block]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={f.competitors} htmlFor="r-comp" hint={f.competitorsHint}><Textarea id="r-comp" name="competitors" rows={4} defaultValue={values.competitors.join("\n")} /></Field>
        <Field label={f.aliases} htmlFor="r-alias"><Textarea id="r-alias" name="clientAliases" rows={4} defaultValue={values.clientAliases.join("\n")} /></Field>
        <Field label={f.tier1} htmlFor="r-t1" hint={f.tier1Hint}><Textarea id="r-t1" name="tier1" rows={4} defaultValue={values.tier1.join("\n")} /></Field>
        <Field label={f.tier2} htmlFor="r-t2" hint={f.tierHint}><Textarea id="r-t2" name="tier2" rows={4} defaultValue={values.tier2.join("\n")} /></Field>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{f.filters}</legend>
        <Checkbox label={f.excludePaid} name="excludePaid" defaultChecked={values.excludePaid} />
        <Field label={f.topicFilter} htmlFor="r-topics"><Textarea id="r-topics" name="topicFilter" rows={3} defaultValue={values.topicFilter.join("\n")} /></Field>
      </fieldset>

      <Field label={f.commentary} htmlFor="r-comment" hint={f.commentaryHint}><Textarea id="r-comment" name="commentary" rows={6} defaultValue={values.commentary} /></Field>

      <SubmitButton className="self-start">{editing ? f.save : f.create}</SubmitButton>
    </ActionForm>
  );
}
