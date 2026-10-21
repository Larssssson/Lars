import Link from "next/link";
import { PriorityBadge, StatusBadge } from "@/components/tasks/badges";
import { UrgentToggle } from "@/components/tasks/task-actions";
import { TaskEditForm } from "@/components/tasks/task-edit-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { finalTextsFor } from "@/lib/domain/clients/profile";
import type { Fact, SectionContent } from "@/lib/domain/clients/profile-sections";
import { checkLabel, latestCheck } from "@/lib/domain/documents/check";
import { loadDocument } from "@/lib/domain/documents/service";
import type { FormatRules } from "@/lib/domain/documents/structure-check";
import {
  canApproveText,
  canCreateTaskForOthers,
  canEditDocument,
  canEditTask,
  canEscalatePriority,
  canRequestApproval,
  WRITABLE_STATUSES,
  type NamedActor,
} from "@/lib/domain/permissions";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import { approversForClient } from "@/lib/domain/permissions/queries";
import { computePriority } from "@/lib/domain/tasks/rules";
import type { JSONNode } from "@/lib/editor/content";
import { formatDateTime, formatRelative, formatWaiting, toLocalInput } from "@/lib/time";
import type { FindingView } from "./check-panel";
import { DocumentWorkspace, type CommentView } from "./document-workspace";
import { SaveVersionButton } from "./version-button";
import {
  ClientAgreedButton,
  DecisionForms,
  DispatchForm,
  ImportWordForm,
  ReopenButton,
  RequestApprovalForm,
  WithdrawButton,
} from "./workflow-panel";

/** Arbeitsplatz eines Dokuments in drei Spalten (BRIEFING 7.2). */
export async function DocumentTaskPage({ taskId, user }: { taskId: string; user: NamedActor & { name: string } }) {
  const { task, document, openApproval } = await loadDocument(prisma, taskId);
  const now = new Date();
  const ctx = await loadPermissionContext(prisma, user.id);
  const isOwner = task.ownerId === user.id;
  const manage = canEditTask(user, ctx, task);
  const decision = canApproveText(user, ctx, task);
  const inReview = task.status === "FREIGABE_ANGEFRAGT";
  const mayEdit = canEditDocument(user, ctx, { ...task, claimedBy: openApproval?.claimedBy ?? null });
  const autoClaim = inReview && decision.allowed && !isOwner;

  const [versions, approvals, dispatches, comments, approvers, users, check, insertions, profileRows, speakers, finalTexts] = await Promise.all([
    prisma.documentVersion.findMany({ where: { documentId: document.id }, orderBy: { number: "desc" } }),
    prisma.approval.findMany({ where: { documentId: document.id }, orderBy: { requestedAt: "desc" }, include: { version: { select: { number: true } } } }),
    prisma.dispatch.findMany({ where: { documentId: document.id }, orderBy: { sentAt: "desc" } }),
    prisma.comment.findMany({ where: { documentId: document.id }, orderBy: { createdAt: "asc" } }),
    approversForClient(prisma, task.clientId),
    prisma.user.findMany({ select: { id: true, name: true } }),
    latestCheck(prisma, document.id),
    prisma.aiInsertion.findMany({ where: { documentId: document.id, status: "ANGENOMMEN" } }),
    prisma.clientProfileSection.findMany({ where: { clientId: task.clientId, key: { in: ["ziele_kernbotschaften", "factsheet", "qa"] } } }),
    prisma.speaker.findMany({ where: { clientId: task.clientId }, orderBy: { name: "asc" } }),
    finalTextsFor(prisma, task.clientId, 6),
  ]);
  const section = (key: string) => (profileRows.find((r) => r.key === key)?.content ?? {}) as SectionContent;
  const asList = (v: unknown) => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : String((x as Fact).text))) : []);
  const knowledge = {
    clientId: task.clientId,
    coreMessages: asList(section("ziele_kernbotschaften").kernbotschaften),
    speakers: speakers.map((sp) => ({ id: sp.id, name: sp.name, function: sp.function, quoteNeedsClientApproval: sp.quoteNeedsClientApproval })),
    facts: (Array.isArray(section("factsheet").fakten) ? section("factsheet").fakten : []) as Fact[],
    boilerplate: String(section("factsheet").boilerplate ?? ""),
    qa: String(section("qa").inhalt ?? ""),
    finalTexts: finalTexts.filter((f) => f.id !== task.id).slice(0, 5).map((f) => ({ taskId: f.id, title: f.title, format: f.document?.documentFormat.name ?? "" })),
  };
  const checkView = check && {
    mode: check.mode,
    createdAt: check.createdAt.toISOString(),
    label: checkLabel(check),
    outdated: JSON.stringify(check.version.content) !== JSON.stringify(document.content),
    conformity: check.scores.conformity,
    resonance: check.scores.resonance,
    warnings: check.scores.warnings ?? [],
    aiNotice: check.scores.aiNotice ?? null,
    findings: check.findings.map((f) => ({
      id: f.id, category: f.category, severity: f.severity, confidence: f.confidence,
      anchor: f.anchor as FindingView["anchor"], message: f.message, reason: f.reason, status: f.status, suggestion: f.suggestion,
    })),
  };
  const openFindings = checkView?.findings.filter((f) => f.status === "OFFEN").length ?? 0;
  const name = (id: string | null | undefined) => users.find((u) => u.id === id)?.name ?? "";
  const eligibleApprovers = approvers.filter((a) => a.id !== task.ownerId);
  const preselected = task.preferredApproverId && eligibleApprovers.some((a) => a.id === task.preferredApproverId)
    ? [task.preferredApproverId]
    : eligibleApprovers.map((a) => a.id);
  const lastChanges = approvals.find((a) => a.decision === "AENDERUNGEN");
  const lastApproved = approvals.find((a) => a.decision === "FREIGEGEBEN");
  const lastFiled = dispatches.find((d) => d.sharePointFileUrl);

  const commentViews: CommentView[] = comments.map((c) => ({
    id: c.id,
    threadId: c.threadId,
    body: c.body,
    authorName: name(c.createdBy),
    createdAt: c.createdAt.toISOString(),
    resolvedAt: c.resolvedAt?.toISOString() ?? null,
    anchor: c.anchor as CommentView["anchor"],
  }));

  type Event = { at: Date; text: string; marker?: string };
  const events: Event[] = [
    ...versions.filter((v) => v.reason !== "STATUSWECHSEL" || v.status).map((v) => ({
      at: v.createdAt,
      text: `${t.documents.info.versionLabel(v.number)} · ${v.status && v.reason === "STATUSWECHSEL" ? t.tasks.statuses[v.status] : t.documents.info.reasons[v.reason]} · ${name(v.createdBy)}`,
    })),
    ...approvals.filter((a) => a.decision === "FREIGEGEBEN").map((a) => ({
      at: a.decidedAt ?? a.requestedAt,
      text: t.approvals.approvedBy(name(a.decidedBy), a.version.number),
      marker: a.isSelfApproval ? t.documents.info.selfApproval : undefined,
    })),
    ...approvals.filter((a) => a.decision === "AENDERUNGEN").map((a) => ({ at: a.decidedAt ?? a.requestedAt, text: `${t.approvals.changesRequestedBy(name(a.decidedBy))}: ${a.note ?? ""}` })),
    ...insertions.map((i) => ({ at: i.acceptedAt ?? i.updatedAt, text: t.ai.acceptedHistory(t.ai.kinds[i.kind], name(i.acceptedBy)) })),
    ...dispatches.map((d) => ({ at: d.sentAt, text: t.dispatch.sentBy(name(d.sentBy), t.dispatch.targets[d.target], formatDateTime(d.sentAt)) })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const owners = manage
    ? canCreateTaskForOthers(user, ctx, task.clientId)
      ? await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : [{ id: task.owner.id, name: task.owner.name }]
    : [];
  const lockedApproved = ["FREIGEGEBEN", "BEIM_KUNDEN", "ERLEDIGT", "ARCHIVIERT"].includes(task.status);
  const f = t.tasks.fields;
  const info = t.documents.info;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          <Link href="/redaktion" className="underline">{t.redaktion.title}</Link> · {task.client.name} · {document.documentFormat.name}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={computePriority(task.dueAt, task.priorityManual, now)} />
          {task.embargoAt && <Badge>{t.tasks.embargoUntil(formatDateTime(task.embargoAt))}</Badge>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* links: Aufgabeninfos, Freigabe und Versand, Verlauf, Versionen */}
        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">{f.client}</dt><dd>{task.client.name}</dd>
              <dt className="text-muted-foreground">{f.owner}</dt><dd>{task.owner.name}</dd>
              <dt className="text-muted-foreground">{f.due}</dt><dd>{formatDateTime(task.dueAt)}<span className="block text-xs text-muted-foreground">{formatRelative(task.dueAt, now)}</span></dd>
              <dt className="text-muted-foreground">{f.embargo}</dt><dd>{task.embargoAt ? formatDateTime(task.embargoAt) : "–"}</dd>
              {task.project && <><dt className="text-muted-foreground">{f.project}</dt><dd>{task.project.title}</dd></>}
            </dl>
            {task.priorityManual && <p className="mt-2 text-xs text-muted-foreground">{t.tasks.manualUrgent}</p>}
            {canEscalatePriority(user) && !lockedApproved && (
              <div className="mt-3"><UrgentToggle taskId={task.id} marked={task.priorityManual === "DRINGEND"} /></div>
            )}
          </Card>

          <Card className="flex flex-col gap-3 p-4" data-testid="workflow">
            <CardTitle>{t.tasks.fields.status}: {t.tasks.statuses[task.status]}</CardTitle>
            {task.status === "AENDERUNGEN_ANGEFORDERT" && lastChanges && (
              <p className="rounded-md bg-orange-50 p-2 text-sm text-orange-900 dark:bg-orange-950 dark:text-orange-100">
                {t.approvals.changesRequestedBy(name(lastChanges.decidedBy))}: {lastChanges.note}
              </p>
            )}
            {WRITABLE_STATUSES.includes(task.status) && canRequestApproval(user, task) && (
              <details open={task.status !== "OFFEN"}>
                <summary className="cursor-pointer text-sm font-medium">{t.approvals.request}</summary>
                <div className="mt-3"><RequestApprovalForm taskId={task.id} approvers={eligibleApprovers} preselected={preselected} /></div>
              </details>
            )}
            {inReview && openApproval && (
              <div className="flex flex-col gap-2 text-sm">
                <p>{t.approvals.waitingSince(formatWaiting(openApproval.requestedAt, now))}</p>
                <p className="text-muted-foreground">{openApproval.checkRunId ? t.approvals.checked(openFindings) : t.approvals.notChecked}</p>
                {openApproval.note && <p className="rounded-md bg-muted p-2">{t.approvals.requestedNote(name(openApproval.requestedBy))}: {openApproval.note}</p>}
                {openApproval.claimedBy && <p>{openApproval.claimedBy === user.id ? t.approvals.youReview : t.approvals.claimedBy(name(openApproval.claimedBy))}</p>}
                {isOwner && <WithdrawButton taskId={task.id} />}
                {decision.allowed && (!openApproval.claimedBy || openApproval.claimedBy === user.id) && (
                  <DecisionForms taskId={task.id} selfApproval={decision.isSelfApproval} />
                )}
              </div>
            )}
            {task.status === "FREIGEGEBEN" && lastApproved && (
              <p className="text-sm text-muted-foreground">
                {t.approvals.approvedBy(name(lastApproved.decidedBy), lastApproved.version.number)}
                {lastApproved.isSelfApproval && <Badge className="ml-2">{info.selfApproval}</Badge>}
              </p>
            )}
            {task.status === "FREIGEGEBEN" && manage && (
              <>
                <p className="text-sm font-medium">{t.dispatch.nextStep}</p>
                <DispatchForm taskId={task.id} title={task.title} clientHasLogo={Boolean(task.client.logoFileId)} />
                <ReopenButton taskId={task.id} label={t.documents.reopen} />
              </>
            )}
            {task.status === "BEIM_KUNDEN" && (
              <div className="flex flex-col gap-3 text-sm">
                <p>{t.dispatch.atClient}</p>
                {manage && (
                  <>
                    <ClientAgreedButton taskId={task.id} />
                    <p className="font-medium">{t.dispatch.clientChanges}</p>
                    <p className="text-xs text-muted-foreground">{t.dispatch.clientChangesHint}</p>
                    <ImportWordForm taskId={task.id} label={t.dispatch.uploadRevision} />
                    <ReopenButton taskId={task.id} label={t.dispatch.editDirectly} />
                  </>
                )}
              </div>
            )}
            {task.status === "ERLEDIGT" && lastFiled && (
              <p className="text-sm">{t.dispatch.done}<span className="mt-1 block text-xs break-all text-muted-foreground" data-testid="sharepoint-path">{decodeURIComponent(lastFiled.sharePointFileUrl!.replace(/^file:\/\/.*?impress\/Kunden\//, ""))}</span></p>
            )}
            {mayEdit && WRITABLE_STATUSES.includes(task.status) && (
              <details>
                <summary className="cursor-pointer text-sm font-medium">{t.documents.importWord}</summary>
                <div className="mt-3"><ImportWordForm taskId={task.id} label={t.documents.importWord} confirm={t.documents.importConfirm} /></div>
              </details>
            )}
          </Card>

          <Card className="p-4">
            <CardTitle>{info.versions}</CardTitle>
            <ul className="mt-2 flex flex-col gap-1 text-sm" data-testid="versions">
              {versions.map((v, i) => (
                <li key={v.id} className="flex justify-between gap-2">
                  <span>{info.versionLabel(v.number)} <span className="text-xs text-muted-foreground">· {info.reasons[v.reason]}</span></span>
                  {versions[i + 1] && <Link className="text-xs underline" href={`/aufgaben/${task.id}/versionen?a=${versions[i + 1]!.number}&b=${v.number}`}>{info.compare}</Link>}
                </li>
              ))}
            </ul>
            {(manage || mayEdit) && <div className="mt-3"><SaveVersionButton taskId={task.id} /></div>}
          </Card>

          <Card className="p-4">
            <CardTitle>{info.history}</CardTitle>
            {events.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{info.noHistory}</p> : (
              <ul className="mt-2 flex flex-col gap-1.5 text-xs" data-testid="history">
                {events.map((e, i) => (
                  <li key={i}>
                    <span className="text-muted-foreground">{formatDateTime(e.at)}</span> {e.text}
                    {e.marker && <Badge className="ml-1 border-orange-300 text-orange-800">{e.marker}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {manage && !lockedApproved && (
            <details className="rounded-lg border bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium">{t.tasks.editTask}</summary>
              <div className="mt-3">
                <TaskEditForm
                  taskId={task.id}
                  title={task.title}
                  description={task.description ?? ""}
                  dueAt={toLocalInput(task.dueAt)}
                  embargoAt={task.embargoAt ? toLocalInput(task.embargoAt) : ""}
                  ownerId={task.ownerId}
                  preferredApproverId={task.preferredApproverId ?? ""}
                  owners={owners}
                  approvers={eligibleApprovers}
                />
              </div>
            </details>
          )}
        </div>

        <DocumentWorkspace
          taskId={task.id}
          me={{ id: user.id, name: user.name }}
          ownerId={task.ownerId}
          initialContent={document.content as JSONNode}
          initialStatus={task.status}
          trackChangesOn={document.trackChangesOn}
          mayEdit={mayEdit}
          autoClaim={autoClaim}
          comments={commentViews}
          aiAllowed={task.client.aiAllowed}
          knowledge={knowledge}
          check={checkView}
          strictness={task.client.checkStrictness}
          formatRules={document.documentFormat.rules as FormatRules}
          banner={lockedApproved ? <p role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">{t.documents.lockedApproved}</p> : undefined}
        />
      </div>
    </div>
  );
}
