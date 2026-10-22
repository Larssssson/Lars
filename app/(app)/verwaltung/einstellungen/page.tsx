import { updateGeneralSettingsAction, updateRpTemplateAction } from "@/app/(app)/verwaltung/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { RP_FONT, RP_LIGHT_BLUE } from "@/lib/domain/documents/export-template";
import { generalSettings, rpTemplateSettings } from "@/lib/domain/settings";
import { requireUser } from "@/lib/session";

/** Einstellungen (BRIEFING 7.10): Eskalationszeiten, Relevanzschwelle, Top-Artikel, RP-Vorlage. */
export default async function SettingsPage() {
  await requireUser();
  const [general, template] = await Promise.all([generalSettings(prisma), rpTemplateSettings(prisma)]);
  const logo = template.logoFileId ? await prisma.file.findUnique({ where: { id: template.logoFileId }, select: { name: true } }) : null;
  const s = t.admin.settings;
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardTitle className="mb-3">{s.general}</CardTitle>
        <ActionForm action={updateGeneralSettingsAction} className="flex max-w-2xl flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={s.escalationFirst} htmlFor="set-esc1"><Input id="set-esc1" name="escalationFirstMinutes" type="number" min={5} max={1440} required defaultValue={general.escalationFirstMinutes} /></Field>
            <Field label={s.escalationSecond} htmlFor="set-esc2"><Input id="set-esc2" name="escalationSecondMinutes" type="number" min={5} max={1440} required defaultValue={general.escalationSecondMinutes} /></Field>
          </div>
          <p className="text-xs text-muted-foreground">{s.escalationHint}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={s.relevanceThreshold} htmlFor="set-threshold"><Input id="set-threshold" name="relevanceThreshold" type="number" min={0} max={100} required defaultValue={general.relevanceThreshold} /></Field>
            <Field label={s.topArticles} htmlFor="set-top"><Input id="set-top" name="topArticles" type="number" min={1} max={50} required defaultValue={general.topArticles} /></Field>
          </div>
          <p className="text-xs text-muted-foreground">{s.reviewDeadline}</p>
          <div><SubmitButton>{s.save}</SubmitButton></div>
        </ActionForm>
      </Card>
      <Card>
        <CardTitle className="mb-1">{s.template}</CardTitle>
        <p className="mb-3 text-xs text-muted-foreground">{s.templateHint}</p>
        <ActionForm action={updateRpTemplateAction} className="flex max-w-2xl flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={s.color} htmlFor="set-color"><Input id="set-color" name="color" required pattern="#?[0-9A-Fa-f]{6}" defaultValue={template.color ?? RP_LIGHT_BLUE} /></Field>
            <Field label={s.font} htmlFor="set-font"><Input id="set-font" name="font" required defaultValue={template.font ?? RP_FONT} /></Field>
          </div>
          <p className="text-sm">{s.currentLogo}: {logo?.name ?? s.placeholderLogo}</p>
          <Field label={s.logo} htmlFor="set-logo"><Input id="set-logo" name="logo" type="file" accept="image/png,image/jpeg" className="py-1.5" /></Field>
          <div><SubmitButton>{s.save}</SubmitButton></div>
        </ActionForm>
      </Card>
    </div>
  );
}
