"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { t } from "@/i18n";
import { DomainError } from "@/lib/domain/errors";
import { createTask, setManualUrgent, setSimpleTaskStatus, updateTask, type Attachment } from "@/lib/domain/tasks/service";
import type { TaskStatus } from "@/lib/generated/prisma/enums";
import { runAction, str, type ActionState } from "@/lib/server/action";
import { serverDeps } from "@/lib/server/deps";
import { requireUser } from "@/lib/session";
import { fromLocalInput } from "@/lib/time";

const MAX_ATTACHMENT = 20 * 1024 * 1024;

function dateField(form: FormData, key: string, required: boolean): Date | null {
  const raw = str(form, key);
  if (!raw) {
    if (required) throw new DomainError(t.tasks.errors.dueRequired);
    return null;
  }
  const date = fromLocalInput(raw);
  if (!date) throw new DomainError(t.errors.dateInvalid);
  return date;
}

async function attachments(form: FormData): Promise<Attachment[]> {
  const files = form.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.some((f) => f.size > MAX_ATTACHMENT)) throw new DomainError(t.tasks.errors.attachmentTooLarge);
  return Promise.all(
    files.map(async (f) => ({ name: f.name, mimeType: f.type || "application/octet-stream", data: new Uint8Array(await f.arrayBuffer()) })),
  );
}

export async function createTaskAction(_state: ActionState, form: FormData): Promise<ActionState> {
  let taskId = "";
  const result = await runAction(async () => {
    const user = await requireUser();
    const task = await createTask(
      serverDeps(),
      user,
      {
        clientId: str(form, "clientId") ?? "",
        category: (str(form, "category") ?? "") as never,
        type: str(form, "type") === "AUFGABE" ? "AUFGABE" : "DOKUMENT",
        format: str(form, "format"),
        title: str(form, "title") ?? "",
        ownerId: str(form, "ownerId") ?? user.id,
        dueAt: dateField(form, "dueAt", true) as Date,
        embargoAt: dateField(form, "embargoAt", false),
        projectId: str(form, "projectId"),
        agreedServiceId: str(form, "agreedServiceId"),
        preferredApproverId: str(form, "preferredApproverId"),
        description: str(form, "description"),
      },
      await attachments(form),
    );
    taskId = task.id;
  });
  if (result?.error) return result;
  revalidatePath("/", "layout");
  redirect(`/aufgaben/${taskId}`);
}

export async function updateTaskAction(taskId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const user = await requireUser();
    await updateTask(serverDeps(), user, taskId, {
      title: str(form, "title") ?? "",
      description: str(form, "description"),
      dueAt: dateField(form, "dueAt", true) as Date,
      embargoAt: dateField(form, "embargoAt", false),
      ownerId: str(form, "ownerId") ?? "",
      preferredApproverId: str(form, "preferredApproverId"),
    });
    return t.common.saved;
  });
  revalidatePath("/", "layout");
  return result;
}

export async function setStatusAction(taskId: string, status: TaskStatus, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await setSimpleTaskStatus(serverDeps(), await requireUser(), taskId, status);
  });
  revalidatePath("/", "layout");
  return result;
}

export async function setUrgentAction(taskId: string, urgent: boolean, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await setManualUrgent(serverDeps(), await requireUser(), taskId, urgent);
  });
  revalidatePath("/", "layout");
  return result;
}
