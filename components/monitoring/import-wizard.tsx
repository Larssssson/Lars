"use client";

import { useActionState } from "react";
import { monitoringImportAction, type MonitoringImportState } from "@/app/(app)/pressespiegel/actions";
import { SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { t } from "@/i18n";

const FIELDS = Object.keys(t.monitoring.importFields);

/** Import des Meltwater-Exports (BRIEFING 7.6 Schritt 2): hochladen, Spalten zuordnen, importieren. */
export function MonitoringImportWizard() {
  const [state, action] = useActionState(monitoringImportAction, {} as MonitoringImportState);
  const im = t.monitoring.import;
  return (
    <div className="flex flex-col gap-3" data-testid="monitoring-import">
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {!state.columns && !state.done && (
        <form action={action} className="flex max-w-xl flex-col gap-3">
          <input type="hidden" name="step" value="upload" />
          <Field label={im.file} htmlFor="monitoring-file"><Input id="monitoring-file" name="file" type="file" accept=".csv,.xlsx" required className="py-1.5" /></Field>
          <div><SubmitButton>{im.upload}</SubmitButton></div>
        </form>
      )}
      {state.columns && !state.done && (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="step" value="import" />
          <h3 className="font-medium">{im.mapping}</h3>
          <p className="text-sm">{state.fileName}{state.savedApplied ? ` · ${im.savedMapping}` : ""}</p>
          <p className="text-xs text-muted-foreground">{im.mappingHint}</p>
          <table className="w-full max-w-3xl text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-1">{im.column}</th><th className="py-1">{im.target}</th><th className="py-1" /></tr>
            </thead>
            <tbody>
              {state.columns.map((column, i) => (
                <tr key={column} className="border-t">
                  <td className="py-1.5 pr-3 font-medium"><label htmlFor={`map-${i}`}>{column}</label></td>
                  <td className="py-1.5 pr-3">
                    <Select id={`map-${i}`} name={`map-${i}`} defaultValue={state.mapping?.[column] ?? ""}>
                      <option value="">{im.ignore}</option>
                      {FIELDS.map((f) => <option key={f} value={f}>{t.monitoring.importFields[f]}</option>)}
                    </Select>
                  </td>
                  <td className="py-1.5 text-xs text-muted-foreground">{state.sample?.map((r) => r[column]).filter(Boolean).slice(0, 1).join("")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div><SubmitButton>{im.run}</SubmitButton></div>
        </form>
      )}
      {state.done && (
        <div className="flex flex-col gap-2">
          <p role="status" className="text-sm font-medium">{state.done}</p>
          {state.notice && <p className="text-sm text-muted-foreground">{state.notice}</p>}
          <form action={action}><input type="hidden" name="step" value="reset" /><Button type="submit" size="sm" variant="outline">{im.another}</Button></form>
        </div>
      )}
    </div>
  );
}
