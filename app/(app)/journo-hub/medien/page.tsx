import { saveMediaAction } from "@/app/(app)/journo-hub/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

function MediaFields({ prefix, values }: { prefix: string; values?: { name: string; type: string; desks: string[] } }) {
  const f = t.journo.fields;
  return (
    <>
      <Field label={f.name} htmlFor={`${prefix}-name`}><Input id={`${prefix}-name`} name="name" required defaultValue={values?.name} /></Field>
      <Field label={f.mediaType} htmlFor={`${prefix}-type`}>
        <Select id={`${prefix}-type`} name="type" defaultValue={values?.type ?? "LEITMEDIUM"}>
          {Object.entries(t.journo.mediaTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label={f.desks} htmlFor={`${prefix}-desks`} hint={f.desksHint}><Input id={`${prefix}-desks`} name="desks" defaultValue={values?.desks.join(", ")} /></Field>
    </>
  );
}

/** Medien mit Typ und Ressorts (Datenmodell 5). */
export default async function MediaPage() {
  await requireUser();
  const media = await prisma.media.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { journalists: true } } } });
  const j = t.journo;
  return (
    <div className="flex flex-col gap-4">
      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-medium">{j.newMedia}</summary>
        <ActionForm action={saveMediaAction.bind(null, null)} className="mt-3 grid gap-3 sm:grid-cols-3">
          <MediaFields prefix="new" />
          <div><SubmitButton size="sm">{j.create}</SubmitButton></div>
        </ActionForm>
      </details>
      <ul className="divide-y rounded-lg border" data-testid="media">
        {media.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 p-3 text-sm">
            <span><strong>{m.name}</strong> <span className="text-muted-foreground">· {j.mediaTypes[m.type]} · {m.desks.join(", ") || "–"} · {j.count(m._count.journalists)}</span></span>
            <details>
              <summary className="cursor-pointer text-xs">{j.edit}</summary>
              <ActionForm action={saveMediaAction.bind(null, m.id)} className="mt-2 grid gap-3 sm:grid-cols-3">
                <MediaFields prefix={m.id} values={m} />
                <div><SubmitButton size="sm">{j.save}</SubmitButton></div>
              </ActionForm>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
