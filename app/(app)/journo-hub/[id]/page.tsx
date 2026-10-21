import Link from "next/link";
import { notFound } from "next/navigation";
import {
  approveOwnerAction,
  becomeOwnerAction,
  deleteContactAction,
  relationAction,
  requestContactAction,
  revokeAction,
  updateContactAction,
  verifyAction,
} from "@/app/(app)/journo-hub/actions";
import { ContactFields } from "@/components/journo/contact-fields";
import { RevealButton } from "@/components/journo/reveal-button";
import { ContactStatusBadge } from "@/components/journo/status-badge";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { missingForVerification, type RevealContext } from "@/lib/domain/journo/contacts";
import { contactView } from "@/lib/domain/journo/queries";
import { canRevokeVerificationOrDeleteContact, isCvd } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/time";

/** Kontaktseite (BRIEFING 7.5). ?aufgabe= setzt den Freigabe-Kontext einer Aufgabe (DECISIONS D-012). */
export default async function ContactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aufgabe?: string }> }) {
  const { id } = await params;
  const { aufgabe } = await searchParams;
  const user = await requireUser();
  const now = new Date();
  const task = aufgabe && /^[0-9a-f-]{36}$/.test(aufgabe) ? await prisma.task.findUnique({ where: { id: aufgabe }, select: { id: true, title: true, clientId: true, projectId: true } }) : null;
  const context: RevealContext = task ? { clientId: task.clientId, projectId: task.projectId } : { clientId: user.selectedClientId };
  const view = await contactView(prisma, user, id, context, now).catch(() => null);
  if (!view) notFound();
  const { contact } = view;
  const [missing, media, clients, projects, myRequests] = await Promise.all([
    missingForVerification(prisma, contact.id),
    prisma.media.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.client.findMany({ where: { status: { not: "ARCHIVIERT" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({ where: { status: { in: ["GEPLANT", "LAUFEND"] } }, orderBy: { title: "asc" }, include: { client: { select: { name: true } } } }),
    prisma.contactRequest.findMany({ where: { journalistId: contact.id, requesterId: user.id }, include: { client: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  const j = t.journo;
  const f = j.fields;
  const taskId = task?.id ?? null;
  const hasDetail = (kind: string) => view.details.some((d) => d.kind === kind);
  const detailMode = (kind: string) => (view.mayReveal ? "edit" : hasDetail(kind) ? "locked" : "add") as "edit" | "add" | "locked";
  const myOwner = view.owners.find((o) => o.userId === user.id && o.active && !o.pending);
  const contacted = myRequests.some((r) => r.status === "FREIGEGEBEN");
  const cvd = isCvd(user);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{contact.firstName} {contact.lastName}</h2>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <ContactStatusBadge status={contact.status} />
            {contact.media?.name ?? j.noMedia}{contact.desk ? ` · ${contact.desk}` : ""}{contact.function ? ` · ${contact.function}` : ""}
          </p>
          {task && <p className="mt-1 text-xs text-muted-foreground">{t.tasks.fields.title}: <Link className="underline" href={`/aufgaben/${task.id}`}>{task.title}</Link></p>}
        </div>
        {contact.status !== "VERIFIZIERT" ? (
          <div className="flex flex-col items-end gap-1">
            <ActionForm action={verifyAction.bind(null, contact.id)}>
              <SubmitButton size="sm" disabled={missing.length > 0}>{j.verify}</SubmitButton>
            </ActionForm>
            {missing.length > 0 && <p className="text-xs text-muted-foreground" data-testid="verify-missing">{j.verifyMissing(missing.join(", "))}</p>}
          </div>
        ) : canRevokeVerificationOrDeleteContact(user) && (
          <details className="text-sm">
            <summary className="cursor-pointer">{j.revoke}</summary>
            <ActionForm action={revokeAction.bind(null, contact.id)} className="mt-2 flex flex-col gap-2">
              <Field label={j.revokeReason} htmlFor="revoke-reason"><Input id="revoke-reason" name="reason" required /></Field>
              <div><SubmitButton size="sm" variant="outline">{j.revoke}</SubmitButton></div>
            </ActionForm>
          </details>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-3 p-4">
            <CardTitle>{j.masterData}</CardTitle>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{f.topics}</dt><dd>{contact.topics.join(", ") || "–"}</dd>
              <dt className="text-muted-foreground">{f.region}</dt><dd>{contact.region ?? "–"}</dd>
              <dt className="text-muted-foreground">{f.firstContactAt}</dt><dd>{contact.firstContactAt ? formatDate(contact.firstContactAt) : "–"}</dd>
              <dt className="text-muted-foreground">{j.source}</dt><dd>{j.sources[contact.source ?? ""] ?? contact.source ?? "–"}</dd>
              <dt className="text-muted-foreground">{f.notes}</dt><dd className="whitespace-pre-wrap">{contact.notes ?? "–"}</dd>
            </dl>
            <details>
              <summary className="cursor-pointer text-sm font-medium">{j.edit}</summary>
              <ActionForm action={updateContactAction.bind(null, contact.id, taskId)} className="mt-3 flex flex-col gap-3">
                <ContactFields values={contact} media={media} details={{ phone: detailMode("TELEFON"), mail: detailMode("MAIL") }} />
                <div><SubmitButton size="sm">{j.save}</SubmitButton></div>
              </ActionForm>
            </details>
          </Card>

          <Card className="flex flex-col gap-3 p-4" data-testid="contact-details">
            <CardTitle>{j.contactData}</CardTitle>
            {view.details.length === 0 ? <p className="text-sm text-muted-foreground">{j.notStored}</p> : (
              <ul className="flex flex-col gap-2 text-sm">
                {view.details.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2">
                    <span className="w-16 text-muted-foreground">{j.kinds[d.kind]}</span>
                    {view.mayReveal ? <RevealButton detailId={d.id} masked={d.masked} taskId={taskId} label={d.kind} /> : <span className="font-mono" data-testid={`detail-${d.kind}`}>{d.masked}</span>}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">{view.mayReveal ? j.revealHint : j.detailsLocked}</p>
            {!view.mayReveal && !context.clientId && <p className="text-xs text-muted-foreground">{j.revealNeedsClient}</p>}
          </Card>

          {!view.mayReveal && (
            <Card id="anfragen" className="flex flex-col gap-3 p-4">
              <CardTitle>{j.request.title}</CardTitle>
              {myRequests.length > 0 && (
                <ul className="text-sm" data-testid="my-requests">
                  {myRequests.map((r) => <li key={r.id}>{r.client.name} · {j.request.statuses[r.status]} · {formatDate(r.createdAt)}{r.decisionNote ? ` · ${r.decisionNote}` : ""}</li>)}
                </ul>
              )}
              <ActionForm action={requestContactAction.bind(null, contact.id)} className="grid gap-3 sm:grid-cols-2">
                <Field label={j.request.client} htmlFor="req-client">
                  <Select id="req-client" name="clientId" defaultValue={context.clientId ?? ""} required>
                    <option value="" disabled>{t.common.pleaseChoose}</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
                <Field label={j.request.project} htmlFor="req-project">
                  <Select id="req-project" name="projectId" defaultValue={context.projectId ?? ""}>
                    <option value="">–</option>
                    {projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.client.name}: {pr.title}</option>)}
                  </Select>
                </Field>
                {task && <input type="hidden" name="taskId" value={task.id} />}
                <Field label={j.request.reason} htmlFor="req-reason" className="sm:col-span-2"><Textarea id="req-reason" name="reason" required className="min-h-16" /></Field>
                <Field label={j.request.urgency} htmlFor="req-urgency">
                  <Select id="req-urgency" name="urgency" defaultValue="NORMAL">
                    {Object.entries(j.request.urgencies).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </Field>
                <div className="flex items-end"><SubmitButton size="sm">{j.request.send}</SubmitButton></div>
              </ActionForm>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-3 p-4" data-testid="owners">
            <CardTitle>{j.owners}</CardTitle>
            {view.owners.length === 0 ? <p className="text-sm text-muted-foreground">{j.noOwner}</p> : (
              <ul className="flex flex-col gap-2 text-sm">
                {view.owners.map((o) => (
                  <li key={o.id} className="flex flex-col gap-0.5">
                    <span>
                      <strong>{o.name}</strong> <span className="text-muted-foreground">{j.ownerSince(formatDate(o.since))}</span>
                      {!o.active && <Badge className="ml-2">{j.inactiveOwner}</Badge>}
                      {o.pending && <Badge className="ml-2 border-amber-400">{j.pendingOwner}</Badge>}
                      {o.relationQuality && <span className="text-muted-foreground"> · {j.relation}: {j.quality[o.relationQuality]}</span>}
                    </span>
                    {o.relationNote && <span className="text-muted-foreground">{o.relationNote}</span>}
                    {o.pending && cvd && (
                      <ActionForm action={approveOwnerAction.bind(null, o.id)}><SubmitButton size="sm" variant="outline" className="h-7">{j.approveOwner}</SubmitButton></ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {myOwner && (
              <details>
                <summary className="cursor-pointer text-sm font-medium">{j.relation}</summary>
                <ActionForm action={relationAction.bind(null, contact.id)} className="mt-2 flex flex-col gap-2">
                  <Field label={j.relationQuality} htmlFor="rel-quality">
                    <Select id="rel-quality" name="relationQuality" defaultValue={myOwner.relationQuality ?? ""}>
                      <option value="">–</option>
                      {Object.entries(j.quality).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                  </Field>
                  <Field label={j.relationNote} htmlFor="rel-note"><Textarea id="rel-note" name="relationNote" defaultValue={myOwner.relationNote ?? ""} className="min-h-16" /></Field>
                  <div><SubmitButton size="sm">{j.save}</SubmitButton></div>
                </ActionForm>
              </details>
            )}
            {!myOwner && (contacted || cvd) && (
              <ActionForm action={becomeOwnerAction.bind(null, contact.id)} className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">{j.becomeOwnerHint}</p>
                <div><SubmitButton size="sm" variant="outline">{j.becomeOwner}</SubmitButton></div>
              </ActionForm>
            )}
          </Card>

          {view.whoKnows && (
            <Card className="flex flex-col gap-2 p-4" data-testid="who-knows">
              <CardTitle>{j.whoKnows}</CardTitle>
              {view.whoKnows.length === 0 ? <p className="text-sm text-muted-foreground">{j.whoKnowsEmpty}</p> : (
                <>
                  <ul className="text-sm">
                    {view.whoKnows.map((w) => <li key={w.id}><Link className="underline" href={`/journo-hub/${w.id}`}>{w.name}</Link>{w.desk ? ` (${w.desk})` : ""} · {f.owner}: {w.owners.join(", ")}</li>)}
                  </ul>
                  <p className="text-xs text-muted-foreground">{j.whoKnowsHint}</p>
                </>
              )}
            </Card>
          )}

          <Card className="flex flex-col gap-2 p-4" data-testid="articles">
            <CardTitle>{j.articles}</CardTitle>
            {contact.articles.length === 0 ? <p className="text-sm text-muted-foreground">{j.noArticles}</p> : (
              <ul className="flex flex-col gap-1 text-sm">
                {contact.articles.map((a) => (
                  <li key={a.id}><span className="text-muted-foreground">{formatDate(a.publishedAt)} · {a.mediaName}</span> {a.url ? <a className="underline" href={a.url} target="_blank" rel="noreferrer">{a.headline}</a> : a.headline}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col gap-1 p-4 text-sm" data-testid="contact-history">
            <CardTitle>{j.history}</CardTitle>
            {view.history.createdBy && <p>{j.createdBy(view.history.createdBy, formatDate(view.history.createdAt))}</p>}
            {view.history.verifiedBy && view.history.verifiedAt && <p>{j.verifiedBy(view.history.verifiedBy, formatDate(view.history.verifiedAt))}</p>}
            {view.history.updatedBy && <p>{j.updatedBy(view.history.updatedBy, formatDate(view.history.updatedAt))}</p>}
          </Card>

          {canRevokeVerificationOrDeleteContact(user) && (
            <Card className="flex flex-col gap-2 p-4">
              <CardTitle>{j.privacy}</CardTitle>
              <div className="flex flex-wrap gap-3 text-sm">
                <a className="underline" href={`/api/journo/${contact.id}/auskunft?format=json`}>{j.exportJson}</a>
                <a className="underline" href={`/api/journo/${contact.id}/auskunft?format=pdf`}>{j.exportPdf}</a>
              </div>
              <ActionForm action={deleteContactAction.bind(null, contact.id)} confirm={j.deleteConfirm}>
                <SubmitButton size="sm" variant="destructive">{j.delete}</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
