"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { t } from "@/i18n";

type VersionOption = { id: string; label: string; approved: boolean };

/**
 * Export als Word oder PDF und als Outlook-Mail mit Anhang (DECISIONS D-129). Version, Vorlage, Ton und Länge sind wählbar.
 */
export function ExportCard({ taskId, versions, defaultVersionId, clientHasLogo }: {
  taskId: string;
  versions: VersionOption[];
  defaultVersionId: string | null;
  clientHasLogo: boolean;
}) {
  const m = t.documents.mail;
  const e = t.documents.export;
  const [version, setVersion] = useState(defaultVersionId ?? "");
  const [template, setTemplate] = useState<"RP" | "KUNDE">("RP");
  const [art, setArt] = useState<"docx" | "pdf">("docx");
  const [tone, setTone] = useState<"freundlich" | "nuechtern">("freundlich");
  const [length, setLength] = useState<"kurz" | "lang">("kurz");
  const selected = versions.find((v) => v.id === version);
  const base = (extra: Record<string, string>) => {
    const params = new URLSearchParams({ vorlage: template, ...(version ? { version } : {}), ...extra });
    return params.toString();
  };

  return (
    <div className="flex flex-col gap-3" data-testid="export-card">
      <Field label={m.version} htmlFor="export-version">
        <Select id="export-version" value={version} onChange={(ev) => setVersion(ev.currentTarget.value)}>
          {versions.length === 0 && <option value="">{m.current}</option>}
          {versions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </Select>
      </Field>
      {selected && !selected.approved && <p className="text-xs text-amber-700 dark:text-amber-400">{m.notApproved}</p>}
      <Field label={e.template} htmlFor="export-template">
        <Select id="export-template" value={template} onChange={(ev) => setTemplate(ev.currentTarget.value as "RP" | "KUNDE")}>
          <option value="RP">{e.rp}</option>
          <option value="KUNDE" disabled={!clientHasLogo}>{clientHasLogo ? e.client : `${e.client} (${e.clientUnavailable})`}</option>
        </Select>
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline"><a href={`/api/dokumente/${taskId}/export?${base({ art: "docx" })}`} download>{e.word}</a></Button>
        <Button asChild size="sm" variant="outline"><a href={`/api/dokumente/${taskId}/export?${base({ art: "pdf" })}`} download>{e.pdf}</a></Button>
      </div>
      <fieldset className="mt-1 flex flex-col gap-2 border-t pt-3">
        <div className="grid grid-cols-3 gap-2">
          <Field label={m.tone} htmlFor="mail-tone">
            <Select id="mail-tone" value={tone} onChange={(ev) => setTone(ev.currentTarget.value as typeof tone)}>
              <option value="freundlich">{m.tones.freundlich}</option>
              <option value="nuechtern">{m.tones.nuechtern}</option>
            </Select>
          </Field>
          <Field label={m.length} htmlFor="mail-length">
            <Select id="mail-length" value={length} onChange={(ev) => setLength(ev.currentTarget.value as typeof length)}>
              <option value="kurz">{m.lengths.kurz}</option>
              <option value="lang">{m.lengths.lang}</option>
            </Select>
          </Field>
          <Field label={m.attachment} htmlFor="mail-art">
            <Select id="mail-art" value={art} onChange={(ev) => setArt(ev.currentTarget.value as typeof art)}>
              <option value="docx">Word</option>
              <option value="pdf">PDF</option>
            </Select>
          </Field>
        </div>
        <Button asChild size="sm"><a href={`/api/dokumente/${taskId}/mail?${base({ art, ton: tone, laenge: length })}`} download>{m.open}</a></Button>
        <p className="text-xs text-muted-foreground">{m.hint}</p>
      </fieldset>
    </div>
  );
}
