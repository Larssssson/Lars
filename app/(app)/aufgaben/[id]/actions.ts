"use server";

import { revalidatePath } from "next/cache";
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
    await recordDispatch(serverDeps(), await requireUser(), id.parse(taskId), {
      target: (str(form, "target") ?? "") as never,
      recipients: str(form, "recipients") ?? "",
      channel: str(form, "channel") ?? "",
      template: str(form, "template") === "KUNDE" ? "KUNDE" : "RP",
    });
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
