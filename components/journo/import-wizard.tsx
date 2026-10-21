"use client";

import { useActionState, useState } from "react";
import { importWizardAction, type ImportStep } from "@/app/(app)/journo-hub/actions";
import { SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

const FIELDS = Object.keys(t.journo.import.importFields);

/**
 * Import in vier Schritten (BRIEFING 7.5): Datei hochladen, Spalten zuordnen (speicherbar),
 * Vorschau mit Dubletten und Entscheidung je Zeile, übernehmen.
 */
export function ImportWizard({ savedMappings }: { savedMappings: { id: string; name: string; mapping: Record<string, string> }[] }) {
  const [state, action] = useActionState(importWizardAction, {} as ImportStep);
  const [overrides, setOverrides] = useState<{ key: string; mapping: Record<string, string> } | null>(null);
  const im = t.journo.import;
  const step = state.done ? 4 : state.rows ? 3 : state.columns ? 2 : 1;
  const mapping = overrides && overrides.key === state.fileId ? overrides.mapping : (state.mapping ?? {});

  return (
    <div className="flex flex-col gap-4" data-testid="import-wizard">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label={im.title}>
        {im.steps.map((label, i) => (
          <li key={label} aria-current={step === i + 1 ? "step" : undefined}
            className={cn("rounded-full border px-3 py-1", step === i + 1 ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      {step === 1 && (
        <form action={action} className="flex max-w-xl flex-col gap-3">
          <input type="hidden" name="step" value="upload" />
          <Field label={im.file} htmlFor="import-file"><Input id="import-file" name="file" type="file" accept=".csv,.xlsx,.vcf" required className="py-1.5" /></Field>
          <div><SubmitButton>{im.upload}</SubmitButton></div>
        </form>
      )}

      {step === 2 && state.columns && (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="step" value="preview" />
          <p className="text-sm text-muted-foreground">{state.fileName}</p>
          {savedMappings.length > 0 && (
            <Field label={im.savedMapping} htmlFor="saved-mapping" className="max-w-sm">
              <Select id="saved-mapping" defaultValue="" onChange={(e) => {
                const saved = savedMappings.find((m) => m.id === e.currentTarget.value);
                if (saved) setOverrides({ key: state.fileId ?? "", mapping: Object.fromEntries(state.columns!.map((c) => [c, saved.mapping[c] ?? ""])) });
              }}>
                <option value="">–</option>
                {savedMappings.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
          )}
          <table className="w-full max-w-3xl text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-1">{im.column}</th><th className="py-1">{im.target}</th><th className="py-1">{im.preview}</th></tr>
            </thead>
            <tbody>
              {state.columns.map((column, i) => (
                <tr key={column} className="border-t">
                  <td className="py-1.5 pr-3 font-medium"><label htmlFor={`map-${i}`}>{column}</label></td>
                  <td className="py-1.5 pr-3">
                    <Select id={`map-${i}`} name={`map-${i}`} value={mapping[column] ?? ""}
                      onChange={(e) => setOverrides({ key: state.fileId ?? "", mapping: { ...mapping, [column]: e.currentTarget.value } })}>
                      <option value="">{im.ignore}</option>
                      {FIELDS.map((f) => <option key={f} value={f}>{im.importFields[f]}</option>)}
                    </Select>
                  </td>
                  <td className="py-1.5 text-xs text-muted-foreground">{state.sample?.map((r) => r[column]).filter(Boolean).slice(0, 2).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div><SubmitButton>{im.toPreview}</SubmitButton></div>
        </form>
      )}

      {step === 3 && state.rows && (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="step" value="commit" />
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm" data-testid="import-preview">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  {[im.row, t.journo.fields.name, t.journo.fields.media, t.journo.fields.mail, t.journo.fields.phone, "", ""].map((h, i) => <th key={i} className="px-2 py-1.5 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row) => (
                  <tr key={row.index} className={cn("border-t", row.duplicate && "bg-amber-50 dark:bg-amber-950/40")}>
                    <td className="px-2 py-1.5">{row.index}</td>
                    <td className="px-2 py-1.5">{row.firstName} {row.lastName}</td>
                    <td className="px-2 py-1.5">{row.media || "–"}</td>
                    <td className="px-2 py-1.5">{row.email ?? "–"}</td>
                    <td className="px-2 py-1.5">{row.phones.join(", ") || "–"}</td>
                    <td className="px-2 py-1.5 text-xs">
                      {row.duplicate?.kind === "EXISTING" && im.duplicateOf(row.duplicate.name, im.reasons[row.duplicate.reason] ?? "")}
                      {row.duplicate?.kind === "IN_FILE" && im.duplicateInFile(row.duplicate.row)}
                      {row.problems.length > 0 && <span className="block text-muted-foreground">{row.problems.map((p) => im.problems[p]).join(", ")}</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <label className="sr-only" htmlFor={`decision-${row.index}`}>{im.row} {row.index}</label>
                      <Select id={`decision-${row.index}`} name={`decision-${row.index}`} defaultValue={row.decision} className="h-8" disabled={row.problems.includes("NO_NAME")}>
                        {(row.duplicate?.kind === "EXISTING" ? ["MERGE", "SKIP", "NEW"] : ["NEW", "SKIP"]).map((d) => <option key={d} value={d}>{im.decisions[d]}</option>)}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Field label={im.saveMappingAs} htmlFor="mapping-name" className="max-w-sm"><Input id="mapping-name" name="mappingName" /></Field>
          <div><SubmitButton>{im.commit}</SubmitButton></div>
        </form>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-sm">{state.done}</p>
          <form action={action}><input type="hidden" name="step" value="reset" /><Button type="submit" variant="outline" size="sm">{im.title}</Button></form>
        </div>
      )}
    </div>
  );
}
