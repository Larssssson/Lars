"use server";

import { revalidatePath } from "next/cache";
import { t } from "@/i18n";
import { DomainError } from "@/lib/domain/errors";
import { createProject, setProjectStatus } from "@/lib/domain/tasks/projects";
import type { ProjectStatus } from "@/lib/generated/prisma/enums";
import { runAction, str, type ActionState } from "@/lib/server/action";
import { serverDeps } from "@/lib/server/deps";
import { requireUser } from "@/lib/session";
import { atTime, fromLocalInput } from "@/lib/time";

function day(form: FormData, key: string): Date | null {
  const v = str(form, key);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? atTime(v, "00:00") : null;
}

export async function createProjectAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const dueRaw = str(form, "taskDueAt");
    const taskDueAt = dueRaw ? fromLocalInput(dueRaw) : null;
    if (dueRaw && !taskDueAt) throw new DomainError(t.errors.dateInvalid);
    await createProject(serverDeps(), await requireUser(), {
      clientId: str(form, "clientId") ?? "",
      title: str(form, "title") ?? "",
      kind: (str(form, "kind") ?? "SONSTIGES") as never,
      startDate: day(form, "startDate"),
      endDate: day(form, "endDate"),
      agreedServiceId: str(form, "agreedServiceId"),
      suggestedTasks: form.getAll("suggested").map(String) as never,
      taskDueAt,
    });
    return t.common.saved;
  });
  revalidatePath("/", "layout");
  return result;
}

export async function setProjectStatusAction(projectId: string, status: ProjectStatus, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await setProjectStatus(serverDeps(), await requireUser(), projectId, status);
  });
  revalidatePath("/", "layout");
  return result;
}
