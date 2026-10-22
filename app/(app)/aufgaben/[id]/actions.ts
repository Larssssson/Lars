"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { t } from "@/i18n";
import {
  CheckConfirmationRequired,
  claimApproval,
  decideApproval,
  reopenForEditing,
  requestApproval,
  withdrawApproval,
} from "@/lib/domain/approvals/service";
import { learnFromFinalText } from "@/lib/domain/clients/profile";
import { acceptInsertion, createInsertion, discardInsertion, suggestHeadlines, suggestLead, suggestQuote } from "@/lib/domain/documents/ai-blocks";
import { dismissFinding, markFindingDone, runCheck } from "@/lib/domain/documents/check";
import { clientAgreed, dispatchText, recordDispatch } from "@/lib/domain/documents/dispatch";
import {
  addComment,
  importWord,
  openForEditing,
  releaseLock,
  requestLock,
  resolveThread,
  saveContent,
  saveManualVersion,
  setTrackChanges,
} from "@/lib/domain/documents/service";
import { DomainError } from "@/lib/domain/errors";
import { runAction, str, type ActionState } from "@/lib/server/action";
import { serverDeps } from "@/lib/server/deps";
import { requireUser } from "@/lib/session";

const id = z.uuid();
const refresh = (taskId: string) => revalidatePath(`/aufgaben/${taskId}`);

export async function openDocumentAction(taskId: string) {
  return openForEditing(serverDeps(), await requireUser(), id.parse(taskId));
}

export async function claimAction(taskId: string, force: boolean) {
  const result = await claimApproval(serverDeps(), await requireUser(), id.parse(taskId), force);
  refresh(taskId);
  return result;
}

export async function saveContentAction(taskId: string, content: unknown): Promise<ActionState & { savedAt?: string }> {
  let savedAt: string | undefined;
  const result = await runAction(async () => {
    savedAt = (await saveContent(serverDeps(), await requireUser(), id.parse(taskId), content)).savedAt.toISOString();
  });
  return { ...result, savedAt };
}

export async function releaseLockAction(taskId: string) {
  await releaseLock(serverDeps(), await requireUser(), id.parse(taskId));
}

export async function requestLockAction(taskId: string): Promise<ActionState> {
  return runAction(async () => {
    await requestLock(serverDeps(), await requireUser(), id.parse(taskId));
    return t.documents.editRequested;
  });
}

export async function setTrackChangesAction(taskId: string, on: boolean): Promise<ActionState> {
  const result = await runAction(async () => setTrackChanges(serverDeps(), await requireUser(), id.parse(taskId), on));
  refresh(taskId);
  return result;
}

export async function saveVersionAction(taskId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    const version = await saveManualVersion(serverDeps(), await requireUser(), id.parse(taskId));
    return t.documents.info.versionLabel(version.number);
  });
  refresh(taskId);
  return result;
}

export async function importWordAction(taskId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const file = form.get("datei");
    if (!(file instanceof File) || file.size === 0) throw new DomainError(t.documents.errors.notDocx);
    if (file.size > 20 * 1024 * 1024) throw new DomainError(t.tasks.errors.attachmentTooLarge);
    await importWord(serverDeps(), await requireUser(), id.parse(taskId), {
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      data: new Uint8Array(await file.arrayBuffer()),
    });
  });
  refresh(taskId);
  return result;
}

export async function addCommentAction(
  taskId: string,
  input: { body: string; threadId?: string | null; anchorThreadId?: string | null; quote?: string | null },
): Promise<ActionState> {
  const result = await runAction(async () => {
    await addComment(serverDeps(), await requireUser(), id.parse(taskId), {
      body: input.body,
      threadId: input.threadId ? id.parse(input.threadId) : null,
      anchorThreadId: input.anchorThreadId ? id.parse(input.anchorThreadId) : null,
      quote: input.quote ?? null,
    });
  });
  refresh(taskId);
  return result;
}

export async function resolveThreadAction(taskId: string, threadId: string, resolved: boolean): Promise<ActionState> {
  const result = await runAction(async () => resolveThread(serverDeps(), await requireUser(), id.parse(taskId), id.parse(threadId), resolved));
  refresh(taskId);
  return result;
}

export async function requestApprovalAction(
  taskId: string,
  input: { approverIds: string[]; note: string; confirmWithoutCheck: boolean },
): Promise<{ error?: string; ok?: string; needsConfirm?: boolean }> {
  try {
    const result = await runAction(async () => {
      await requestApproval(serverDeps(), await requireUser(), id.parse(taskId), {
        approverIds: input.approverIds.map((a) => id.parse(a)),
        note: input.note,
        confirmWithoutCheck: input.confirmWithoutCheck,
      });
    });
    refresh(taskId);
    return result ?? {};
  } catch (error) {
    if (error instanceof CheckConfirmationRequired) return { needsConfirm: true };
    throw error;
  }
}

export async function withdrawAction(taskId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => withdrawApproval(serverDeps(), await requireUser(), id.parse(taskId)));
  refresh(taskId);
  return result;
}

export async function decideAction(taskId: string, decision: "FREIGEGEBEN" | "AENDERUNGEN", _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => decideApproval(serverDeps(), await requireUser(), id.parse(taskId), { decision, note: str(form, "note") }));
  revalidatePath("/", "layout");
  return result;
}

export async function reopenAction(taskId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => reopenForEditing(serverDeps(), await requireUser(), id.parse(taskId)));
  refresh(taskId);
  return result;
}

export async function dispatchAction(taskId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const user = await requireUser();
    const { done } = await recordDispatch(serverDeps(), user, id.parse(taskId), {
      target: (str(form, "target") ?? "") as never,
      recipients: str(form, "recipients") ?? "",
      channel: str(form, "channel") ?? "",
      template: str(form, "template") === "KUNDE" ? "KUNDE" : "RP",
    });
    // lernendes Profil (BRIEFING 7.7): nach der Antwort, damit der Versand nicht auf die KI wartet
    if (done) after(() => learnFromFinalText(serverDeps(), id.parse(taskId), user.id));
  });
  revalidatePath("/", "layout");
  return result;
}

export async function clientAgreedAction(taskId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => clientAgreed(serverDeps(), await requireUser(), id.parse(taskId)));
  refresh(taskId);
  return result;
}

export async function dispatchTextAction(taskId: string): Promise<string> {
  await requireUser();
  return dispatchText(serverDeps(), id.parse(taskId));
}

// ------------------------------------------------------------- Prüfung (BRIEFING 7.4)

export async function runCheckAction(taskId: string, mode: "SCHNELL" | "VOLL"): Promise<ActionState> {
  const result = await runAction(async () => {
    await runCheck(serverDeps(), await requireUser(), id.parse(taskId), mode === "VOLL" ? "VOLL" : "SCHNELL");
  });
  refresh(taskId);
  return result;
}

export async function findingDoneAction(taskId: string, findingId: string): Promise<ActionState> {
  const result = await runAction(async () => markFindingDone(serverDeps(), await requireUser(), id.parse(findingId)));
  refresh(taskId);
  return result;
}

export async function dismissFindingAction(taskId: string, findingId: string, input: { reason: string; createRule: boolean }): Promise<ActionState> {
  const result = await runAction(async () =>
    dismissFinding(serverDeps(), await requireUser(), id.parse(findingId), { reason: String(input.reason ?? ""), createRule: Boolean(input.createRule) }),
  );
  refresh(taskId);
  return result;
}

// ------------------------------------------------------------- KI-Bausteine (BRIEFING 8.2)

export type AiSuggestionResult = { error?: string; options?: string[]; model?: string; promptVersion?: string; note?: string };

export async function suggestAiAction(taskId: string, kind: "HEADLINE" | "ZITAT" | "LEAD", speakerId?: string): Promise<AiSuggestionResult> {
  let out: AiSuggestionResult = {};
  const result = await runAction(async () => {
    const deps = serverDeps();
    const user = await requireUser();
    const tid = id.parse(taskId);
    if (kind === "HEADLINE") out = await suggestHeadlines(deps, user, tid);
    else if (kind === "ZITAT") {
      const r = await suggestQuote(deps, user, tid, String(speakerId ?? ""));
      out = { ...r, note: r.quoteNeedsClientApproval ? t.ai.quoteNeedsApproval : undefined };
    } else out = await suggestLead(deps, user, tid);
  });
  return result?.error ? { error: result.error } : out;
}

export async function createInsertionAction(taskId: string, input: { kind: "HEADLINE" | "ZITAT" | "LEAD"; model: string; promptVersion: string }): Promise<{ error?: string; id?: string }> {
  let insertionId: string | undefined;
  const result = await runAction(async () => {
    insertionId = (await createInsertion(serverDeps(), await requireUser(), id.parse(taskId), input)).id;
  });
  return result?.error ? { error: result.error } : { id: insertionId };
}

export async function decideInsertionAction(taskId: string, insertionId: string, accept: boolean): Promise<ActionState> {
  const result = await runAction(async () => {
    const fn = accept ? acceptInsertion : discardInsertion;
    await fn(serverDeps(), await requireUser(), id.parse(taskId), id.parse(insertionId));
  });
  refresh(taskId);
  return result;
}
