import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { t } from "@/i18n";

export type ContactValues = {
  id?: string;
  firstName: string;
  lastName: string;
  mediaId: string | null;
  desk: string | null;
  function: string | null;
  topics: string[];
  region: string | null;
  notes: string | null;
  firstContactAt: Date | null;
};

/**
 * Felder eines Kontakts. Vorhandene Kontaktdaten stehen nie im Formular: ein leeres Feld lässt
 * sie unverändert; ohne Aufdecken-Recht lassen sich nur fehlende Angaben ergänzen (DECISIONS D-087).
 */
export function ContactFields({ values, media, details }: {
  values?: ContactValues;
  media: { id: string; name: string }[];
  details: { phone: "edit" | "add" | "locked"; mail: "edit" | "add" | "locked" };
}) {
  const f = t.journo.fields;
  const p = values?.id ?? "new";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={f.firstName} htmlFor={`${p}-first`}><Input id={`${p}-first`} name="firstName" required defaultValue={values?.firstName} /></Field>
      <Field label={f.lastName} htmlFor={`${p}-last`}><Input id={`${p}-last`} name="lastName" required defaultValue={values?.lastName} /></Field>
      <Field label={f.media} htmlFor={`${p}-media`}>
        <Select id={`${p}-media`} name="mediaId" defaultValue={values?.mediaId ?? ""}>
          <option value="">{t.journo.noMedia}</option>
          {media.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </Field>
      <Field label={f.desk} htmlFor={`${p}-desk`}><Input id={`${p}-desk`} name="desk" defaultValue={values?.desk ?? ""} /></Field>
      <Field label={f.function} htmlFor={`${p}-function`}><Input id={`${p}-function`} name="function" defaultValue={values?.function ?? ""} /></Field>
      <Field label={f.region} htmlFor={`${p}-region`}><Input id={`${p}-region`} name="region" defaultValue={values?.region ?? ""} /></Field>
      <Field label={f.topics} htmlFor={`${p}-topics`} hint={f.topicsHint} className="sm:col-span-2">
        <Input id={`${p}-topics`} name="topics" defaultValue={values?.topics.join(", ")} />
      </Field>
      <Field label={f.firstContactAt} htmlFor={`${p}-first-contact`}>
        <Input id={`${p}-first-contact`} name="firstContactAt" type="date" defaultValue={values?.firstContactAt?.toISOString().slice(0, 10) ?? ""} />
      </Field>
      <span />
      {details.phone !== "locked" && (
        <Field label={f.phone} htmlFor={`${p}-phone`}><Input id={`${p}-phone`} name="phone" type="tel" autoComplete="off" /></Field>
      )}
      {details.mail !== "locked" && (
        <Field label={f.mail} htmlFor={`${p}-mail`}><Input id={`${p}-mail`} name="mail" type="email" autoComplete="off" /></Field>
      )}
      <Field label={f.linkedin} htmlFor={`${p}-linkedin`}><Input id={`${p}-linkedin`} name="linkedin" autoComplete="off" /></Field>
      <Field label={f.x} htmlFor={`${p}-x`}><Input id={`${p}-x`} name="x" autoComplete="off" /></Field>
      {(details.phone === "locked" || details.mail === "locked") && <p className="text-xs text-muted-foreground sm:col-span-2">{t.journo.detailsEditHint}</p>}
      <Field label={f.notes} htmlFor={`${p}-notes`} className="sm:col-span-2"><Textarea id={`${p}-notes`} name="notes" defaultValue={values?.notes ?? ""} className="min-h-20" /></Field>
    </div>
  );
}
