import Link from "next/link";
import { decideRequestAction } from "@/app/(app)/journo-hub/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { listContactRequests } from "@/lib/domain/journo/requests";
import { isCvd } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

type Request = Awaited<ReturnType<typeof listContactRequests>>["toMe"][number];

/** Kontaktanfragen (BRIEFING 6.7): an mich mit Entscheidung, meine, und für CVDs alle ohne Benachrichtigung. */
export default async function RequestsPage() {
  const user = await requireUser();
  const { toMe, mine, all, names } = await listContactRequests({ db: prisma }, user);
  const r = t.journo.request;

  return (
    <div className="flex flex-col gap-4">
      <Section title={r.toMe} items={toMe} decide testId="requests-to-me" names={names} />
      <Section title={r.mine} items={mine} decide={false} testId="requests-mine" names={names} />
      {isCvd(user) && <Section title={r.all} items={all} decide testId="requests-all" names={names} />}
    </div>
  );
}

function Row({ request, decide, names }: { request: Request; decide: boolean; names: Map<string, string> }) {
  const r = t.journo.request;
  return (
    <li className="flex flex-col gap-1.5 py-3 text-sm">
      <span>
        <Link className="font-medium underline" href={`/journo-hub/${request.journalist.id}`}>{request.journalist.firstName} {request.journalist.lastName}</Link>
        {request.journalist.media && <span className="text-muted-foreground"> · {request.journalist.media.name}</span>}
        {" · "}{request.client.name}{request.project ? ` · ${request.project.title}` : ""}{request.task ? ` · ${request.task.title}` : ""}
      </span>
      <span className="text-muted-foreground">
        {r.from(names.get(request.requesterId) ?? "")} · {formatDateTime(request.createdAt)} · {r.urgencies[request.urgency]}
        {" · "}<Badge>{r.statuses[request.status]}</Badge>
        {request.decidedBy && ` · ${names.get(request.decidedBy) ?? ""}`}{request.decisionNote ? `: ${request.decisionNote}` : ""}
      </span>
      <span>{request.reason}</span>
      {decide && request.status === "OFFEN" && (
        <div className="flex flex-wrap items-end gap-2">
          <ActionForm action={decideRequestAction.bind(null, request.id, "FREIGEBEN")}><SubmitButton size="sm">{r.grant}</SubmitButton></ActionForm>
          <ActionForm action={decideRequestAction.bind(null, request.id, "UEBERNEHMEN")}><SubmitButton size="sm" variant="outline">{r.takeOver}</SubmitButton></ActionForm>
          <ActionForm action={decideRequestAction.bind(null, request.id, "ABLEHNEN")} className="flex items-end gap-2">
            <label className="sr-only" htmlFor={`reject-${request.id}`}>{r.rejectReason}</label>
            <Input id={`reject-${request.id}`} name="note" placeholder={r.rejectReason} required className="h-8 w-48" />
            <SubmitButton size="sm" variant="ghost">{r.reject}</SubmitButton>
          </ActionForm>
        </div>
      )}
    </li>
  );
}

function Section({ title, items, decide, testId, names }: { title: string; items: Request[]; decide: boolean; testId: string; names: Map<string, string> }) {
  const r = t.journo.request;
  return (
    <Card className="p-4">
      <CardTitle>{title}</CardTitle>
      {items.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{r.none}</p> : (
        <ul className="divide-y" data-testid={testId}>{items.map((item) => <Row key={item.id} request={item} decide={decide} names={names} />)}</ul>
      )}
    </Card>
  );
}
