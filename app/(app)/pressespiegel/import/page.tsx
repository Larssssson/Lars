import { manualArticleAction } from "@/app/(app)/pressespiegel/actions";
import { MonitoringImportWizard } from "@/components/monitoring/import-wizard";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Textarea } from "@/components/ui/form";
import { t } from "@/i18n";
import { requireUser } from "@/lib/session";

/** Import des Meltwater-Exports und manuelle Anlage einzelner Artikel (BRIEFING 7.6 Schritt 2). */
export default async function MonitoringImportPage() {
  await requireUser();
  const m = t.monitoring;
  const f = m.fields;
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" aria-labelledby="import-title">
        <h2 id="import-title" className="text-lg font-semibold">{m.import.title}</h2>
        <MonitoringImportWizard />
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="manual-title">
        <h2 id="manual-title" className="text-lg font-semibold">{m.manual.title}</h2>
        <ActionForm action={manualArticleAction} className="grid max-w-2xl gap-3 sm:grid-cols-2">
          <Field label={f.headline} htmlFor="m-headline"><Input id="m-headline" name="headline" required /></Field>
          <Field label={f.media} htmlFor="m-media"><Input id="m-media" name="media" required /></Field>
          <Field label={f.publishedAt} htmlFor="m-date"><Input id="m-date" name="publishedAt" type="date" /></Field>
          <Field label={f.author} htmlFor="m-author"><Input id="m-author" name="author" /></Field>
          <Field label={f.url} htmlFor="m-url"><Input id="m-url" name="url" type="url" /></Field>
          <div className="sm:col-span-2"><Field label={f.teaser} htmlFor="m-teaser"><Textarea id="m-teaser" name="teaser" rows={3} /></Field></div>
          <div><SubmitButton>{m.manual.create}</SubmitButton></div>
        </ActionForm>
      </section>
    </div>
  );
}
