import { z } from "zod";
import { t } from "@/i18n";
import type { Deps } from "@/lib/domain/deps";
import { buildTemplateContent, parseBlocks } from "@/lib/domain/documents/template";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { notify } from "@/lib/domain/notifications";
import {
  assert,
  canCreateTask,
  canEditTask,
  canEscalatePriority,
  hasApprovalRight,
  type Actor,
} from "@/lib/domain/permissions";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import type { Priority, Task, TaskStatus } from "@/lib/generated/prisma/client";
import { formatDateTime } from "@/lib/time";
import { ARCHIVE_AFTER_DAYS, canTransitionSimpleTask, computePriority, OPEN_STATUSES } from "./rules";

const optionalUuid = z.uuid().nullish().transform((v) => v ?? null);

/** Formular "Neue Aufgabe" (BRIEFING 6.1). */
export const createTaskSchema = z
  .object({
    clientId: z.uuid({ message: t.tasks.errors.clientRequired }),
    category: z.enum(["MEDIENARBEIT", "DIGITALE_KOMMUNIKATION", "EVENT", "INTERN"], { message: t.tasks.errors.categoryRequired }),
    type: z.enum(["DOKUMENT", "AUFGABE"]),
    format: z.string().nullish().transform((v) => v || null),
    title: z.string().trim().min(1, t.tasks.errors.titleRequired).max(200),
    ownerId: z.uuid(),
    dueAt: z.date({ message: t.tasks.errors.dueRequired }),
    embargoAt: z.date().nullish().transform((v) => v ?? null),
    projectId: optionalUuid,
    agreedServiceId: optionalUuid,
    preferredApproverId: optionalUuid,
    description: z.string().trim().max(5000).nullish().transform((v) => v || null),
  })
  .refine((v) => v.type !== "DOKUMENT" || v.format !== null, { message: t.tasks.errors.formatRequired, path: ["format"] });

export type CreateTaskInput = z.input<typeof createTaskSchema>;

export type Attachment = { name: string; mimeType: string; data: Uint8Array };

async function requireTask(deps: Deps, taskId: string): Promise<Task> {
  const task = await deps.db.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError(t.errors.notFound);
  return task;
}

/** Text der Push-Nachricht: Kunde, Aufgabe, Frist (BRIEFING 7.9). */
async function pushBody(deps: Deps, task: Pick<Task, "clientId" | "title" | "dueAt">): Promise<string> {
  const client = await deps.db.client.findUnique({ where: { id: task.clientId }, select: { name: true } });
  return t.notifications.pushBody(client?.name ?? "", task.title, formatDateTime(task.dueAt));
}

async function notifyAssigned(deps: Deps, task: Task): Promise<void> {
  await notify(deps, {
    userId: task.ownerId,
    kind: "TASK_ASSIGNED",
    title: t.notifications.taskAssigned(task.title),
    link: `/aufgaben/${task.id}`,
    push: task.priority === "DRINGEND",
    pushBody: await pushBody(deps, task),
  });
}

async function notifyUrgent(deps: Deps, task: Task): Promise<void> {
  await notify(deps, {
    userId: task.ownerId,
    kind: "TASK_URGENT",
    title: t.notifications.taskUrgent(task.title),
    link: `/aufgaben/${task.id}`,
    push: true,
    pushBody: await pushBody(deps, task),
  });
}

async function validateReferences(
  deps: Deps,
  input: { clientId: string; projectId: string | null; agreedServiceId: string | null; preferredApproverId: string | null; ownerId: string },
) {
  const client = await deps.db.client.findUnique({ where: { id: input.clientId } });
  if (!client || client.status === "ARCHIVIERT") throw new DomainError(t.tasks.errors.clientRequired);
  const owner = await deps.db.user.findFirst({ where: { id: input.ownerId, active: true } });
  if (!owner) throw new DomainError(t.tasks.errors.ownerInvalid);
  if (input.projectId) {
    const project = await deps.db.project.findFirst({ where: { id: input.projectId, clientId: input.clientId } });
    if (!project) throw new DomainError(t.tasks.errors.projectInvalid);
  }
  if (input.agreedServiceId) {
    const service = await deps.db.agreedService.findFirst({ where: { id: input.agreedServiceId, clientId: input.clientId } });
    if (!service) throw new DomainError(t.tasks.errors.serviceInvalid);
  }
  if (input.preferredApproverId) {
    const approver = await deps.db.user.findFirst({ where: { id: input.preferredApproverId, active: true } });
    const approverCtx = approver ? await loadPermissionContext(deps.db, approver.id) : null;
    if (!approver || !approverCtx || !hasApprovalRight(approver, approverCtx, input.clientId) || approver.id === input.ownerId) {
      throw new DomainError(t.tasks.errors.approverInvalid);
    }
  }
}

/**
 * Aufgabe anlegen (BRIEFING 6.1). Bei Dokument-Aufgaben entsteht ein leeres Dokument
 * aus der Vorlage der Darstellungsform.
 */
export async function createTask(deps: Deps, actor: Actor, raw: CreateTaskInput, attachments: Attachment[] = []): Promise<Task> {
  const input = createTaskSchema.parse(raw);
  const ctx = await loadPermissionContext(deps.db, actor.id);
  assert(canCreateTask(actor, ctx, input));
  await validateReferences(deps, input);

  const format = input.type === "DOKUMENT" && input.format
    ? await deps.db.documentFormat.findUnique({ where: { key: input.format } })
    : null;
  if (input.type === "DOKUMENT" && !format) throw new DomainError(t.tasks.errors.formatRequired);

  const now = deps.now();
  const task = await deps.db.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        clientId: input.clientId,
        projectId: input.projectId,
        agreedServiceId: input.agreedServiceId,
        title: input.title,
        description: input.description,
        category: input.category,
        type: input.type,
        ownerId: input.ownerId,
        dueAt: input.dueAt,
        embargoAt: input.embargoAt,
        preferredApproverId: input.preferredApproverId,
        priority: computePriority(input.dueAt, null, now),
        status: "OFFEN",
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });
    if (format) {
      await tx.document.create({
        data: {
          taskId: created.id,
          format: format.key,
          title: input.title,
          content: buildTemplateContent(parseBlocks(format.blocks)),
          createdBy: actor.id,
          updatedBy: actor.id,
        },
      });
    }
    return created;
  });

  for (const file of attachments) {
    const storageKey = `tasks/${task.id}/${crypto.randomUUID()}`;
    await deps.files.put(storageKey, file.data, file.mimeType);
    await deps.db.file.create({
      data: {
        storageKey,
        name: file.name,
        mimeType: file.mimeType,
        size: file.data.byteLength,
        clientId: task.clientId,
        taskId: task.id,
        uploadedBy: actor.id,
        createdBy: actor.id,
      },
    });
  }

  if (task.ownerId !== actor.id) await notifyAssigned(deps, task);
  return task;
}

/** Aufgabe bearbeiten: Titel, Beschreibung, Frist, Sperrfrist, Owner, bevorzugter Freigeber. */
export const updateTaskSchema = z.object({
  title: z.string().trim().min(1, t.tasks.errors.titleRequired).max(200),
  description: z.string().trim().max(5000).nullish().transform((v) => v || null),
  dueAt: z.date({ message: t.tasks.errors.dueRequired }),
  embargoAt: z.date().nullish().transform((v) => v ?? null),
  ownerId: z.uuid(),
  preferredApproverId: optionalUuid,
});

export async function updateTask(deps: Deps, actor: Actor, taskId: string, raw: z.input<typeof updateTaskSchema>): Promise<Task> {
  const input = updateTaskSchema.parse(raw);
  const task = await requireTask(deps, taskId);
  const ctx = await loadPermissionContext(deps.db, actor.id);
  assert(canEditTask(actor, ctx, task));
  if (input.ownerId !== task.ownerId) assert(canCreateTask(actor, ctx, { clientId: task.clientId, ownerId: input.ownerId }));
  await validateReferences(deps, { ...task, ...input, projectId: null, agreedServiceId: null });

  const priority = computePriority(input.dueAt, task.priorityManual, deps.now());
  const updated = await deps.db.task.update({
    where: { id: task.id },
    data: { ...input, priority, updatedBy: actor.id },
  });
  if (updated.ownerId !== task.ownerId) {
    if (updated.ownerId !== actor.id) await notifyAssigned(deps, updated);
  } else if (priority === "DRINGEND" && task.priority !== "DRINGEND" && updated.ownerId !== actor.id) {
    await notifyUrgent(deps, updated);
  }
  return updated;
}

/** Statuswechsel einfacher Aufgaben (BRIEFING 6.3). */
export async function setSimpleTaskStatus(deps: Deps, actor: Actor, taskId: string, to: TaskStatus): Promise<Task> {
  const task = await requireTask(deps, taskId);
  const ctx = await loadPermissionContext(deps.db, actor.id);
  assert(canEditTask(actor, ctx, task));
  if (task.type !== "AUFGABE") throw new DomainError(t.tasks.errors.documentStatusLater);
  if (!canTransitionSimpleTask(task.status, to)) throw new DomainError(t.tasks.errors.transitionInvalid);
  const now = deps.now();
  return deps.db.task.update({
    where: { id: task.id },
    data: {
      status: to,
      completedAt: to === "ERLEDIGT" ? now : to === "ARCHIVIERT" ? task.completedAt ?? now : null,
      updatedBy: actor.id,
    },
  });
}

/** CVD-Hochstufung auf Dringend und Entfernen der Markierung (BRIEFING 6.2). */
export async function setManualUrgent(deps: Deps, actor: Actor, taskId: string, urgent: boolean): Promise<Task> {
  assert(canEscalatePriority(actor));
  const task = await requireTask(deps, taskId);
  const priority = computePriority(task.dueAt, urgent ? "DRINGEND" : null, deps.now());
  const updated = await deps.db.task.update({
    where: { id: task.id },
    data: { priorityManual: urgent ? "DRINGEND" : null, priority, updatedBy: actor.id },
  });
  if (priority === "DRINGEND" && task.priority !== "DRINGEND" && task.ownerId !== actor.id) await notifyUrgent(deps, updated);
  return updated;
}

/**
 * Job alle 5 Minuten (BRIEFING 6.2): Priorität neu bestimmen, beim Übergang nach Dringend
 * den Owner benachrichtigen (Push, BRIEFING 7.9).
 */
export async function recalculatePriorities(deps: Deps): Promise<{ changed: number; becameUrgent: number }> {
  const now = deps.now();
  const tasks = await deps.db.task.findMany({ where: { status: { in: OPEN_STATUSES } } });
  let changed = 0;
  let becameUrgent = 0;
  for (const task of tasks) {
    const priority: Priority = computePriority(task.dueAt, task.priorityManual, now);
    if (priority === task.priority) continue;
    changed += 1;
    const updated = await deps.db.task.update({ where: { id: task.id }, data: { priority } });
    if (priority === "DRINGEND") {
      becameUrgent += 1;
      await notifyUrgent(deps, updated);
    }
  }
  return { changed, becameUrgent };
}

/** Job täglich: Archivierung 30 Tage nach Erledigt (BRIEFING 6.3). */
export async function archiveCompletedTasks(deps: Deps): Promise<number> {
  const cutoff = new Date(deps.now().getTime() - ARCHIVE_AFTER_DAYS * 86_400_000);
  const result = await deps.db.task.updateMany({
    where: { status: "ERLEDIGT", completedAt: { lte: cutoff } },
    data: { status: "ARCHIVIERT" },
  });
  return result.count;
}
