import Link from "next/link";
import { ContactStatusBadge } from "@/components/journo/status-badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { contactFilterOptions, listContacts } from "@/lib/domain/journo/queries";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/time";

type Params = { q?: string; medium?: string; typ?: string; ressort?: string; thema?: string; status?: string; owner?: string };

/** Liste des Journo Hub mit Filtern; Telefonnummer und Mail sind hier immer verdeckt (BRIEFING 7.5). */
export default async function JournoHubPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser();
  const p = await searchParams;
  const [contacts, options] = await Promise.all([
    listContacts(prisma, { q: p.q, mediaId: p.medium, mediaType: p.typ, desk: p.ressort, topic: p.thema, status: p.status, ownerId: p.owner }),
    contactFilterOptions(prisma),
  ]);
  const j = t.journo;
  const f = j.fields;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><Button asChild size="sm"><Link href="/journo-hub/neu">{j.newContact}</Link></Button></div>
      <form key={JSON.stringify(p)} method="get" className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label={j.filter.apply}>
        <Field label={j.filter.search} htmlFor="f-q"><Input id="f-q" name="q" defaultValue={p.q ?? ""} /></Field>
        <Field label={f.media} htmlFor="f-medium">
          <Select id="f-medium" name="medium" defaultValue={p.medium ?? ""}>
            <option value="">{j.filter.all}</option>
            {options.media.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label={f.mediaType} htmlFor="f-typ">
          <Select id="f-typ" name="typ" defaultValue={p.typ ?? ""}>
            <option value="">{j.filter.all}</option>
            {Object.entries(j.mediaTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label={f.desk} htmlFor="f-ressort">
          <Select id="f-ressort" name="ressort" defaultValue={p.ressort ?? ""}>
            <option value="">{j.filter.all}</option>
            {options.desks.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
        </Field>
        <Field label={f.topics} htmlFor="f-thema">
          <Select id="f-thema" name="thema" defaultValue={p.thema ?? ""}>
            <option value="">{j.filter.all}</option>
            {options.topics.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
        </Field>
        <Field label={f.status} htmlFor="f-status">
          <Select id="f-status" name="status" defaultValue={p.status ?? ""}>
            <option value="">{j.filter.all}</option>
            {Object.entries(j.statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label={f.owner} htmlFor="f-owner">
          <Select id="f-owner" name="owner" defaultValue={p.owner ?? ""}>
            <option value="">{j.filter.all}</option>
            {options.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Field>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm">{j.filter.apply}</Button>
          <Button asChild variant="ghost" size="sm"><Link href="/journo-hub">{j.filter.reset}</Link></Button>
        </div>
      </form>
      <p className="text-sm text-muted-foreground" data-testid="contact-count">{j.count(contacts.length)}</p>
      {contacts.length === 0 ? <p className="text-sm text-muted-foreground">{j.empty}</p> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm" data-testid="contacts">
            <thead className="bg-muted text-left text-xs text-muted-foreground">
              <tr>
                {[f.name, f.media, f.desk, f.topics, f.status, f.owner, f.lastWritten, f.phone, f.mail].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2"><Link href={`/journo-hub/${c.id}`} className="font-medium hover:underline">{c.name}</Link></td>
                  <td className="px-3 py-2">{c.media?.name ?? "–"}</td>
                  <td className="px-3 py-2">{c.desk ?? "–"}</td>
                  <td className="px-3 py-2">{c.topics.join(", ") || "–"}</td>
                  <td className="px-3 py-2"><ContactStatusBadge status={c.status} /></td>
                  <td className="px-3 py-2">
                    {c.owners.length === 0 ? <span className="text-muted-foreground">{j.noOwner}</span> : c.owners.map((o, i) => (
                      <span key={o.id} className={o.active && !o.pending ? "" : "text-muted-foreground"}>{i > 0 && ", "}{o.name}{!o.active ? ` (${j.inactiveOwner})` : ""}</span>
                    ))}
                  </td>
                  <td className="px-3 py-2">{c.lastWrittenAt ? formatDate(c.lastWrittenAt) : "–"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{j.hidden}</td>
                  <td className="px-3 py-2 text-muted-foreground">{j.hidden}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
