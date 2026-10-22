import { z } from "zod";
import { t } from "@/i18n";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { assert, canEditTask, type NamedActor } from "@/lib/domain/permissions";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import type { ProjectStatus } from "@/lib/generated/prisma/client";
import { createTask } from "./service";

/** Typische Aufgaben für Roundtable und Presse-Event (BRIEFING 6.6). */
export const PROJECT_TASK_SUGGESTIONS = [
  { key: "KONZEPT", title: "Konzept" },
  { key: "EINLADUNG", title: "Einladung" },
  { key: "AGENDA", title: "Agenda" },
  { key: "QA", title: "Q&A" },
  { key: "MEDIEN_PITCH", title: "Pitch" },
] as const;

export const SUGGESTING_KINDS = ["ROUNDTABLE", "PRESSE_EVENT"] as const;

export const projectSchema = z.object({
  clientId: z.uuid({ message: t.tasks.errors.clientRequired }),
  title: z.string().trim().min(1, t.projects.errors.titleRequired).max(160),
  kind: z.enum(["PRESSE_EVENT", "ROUNDTABLE", "KAMPAGNE", "SONSTIGES"]),
  startDate: z.date().nullish().transform((v) => v ?? null),
  endDate: z.date().nullish().transform((v) => v ?? null),
  agreedServiceId: z.uuid().nullish().transform((v) => v ?? null),
  suggestedTasks: z.array(z.enum(["KONZEPT", "EINLADUNG", "AGENDA", "QA", "MEDIEN_PITCH"])).default([]),
  /** Frist der vorgeschlagenen Aufgaben */
  taskDueAt: z.date().nullish().transform((v) => v ?? null),
});

/**
 * Projekt anlegen (BRIEFING 6.6). Bei Roundtable und Presse-Event entstehen die per Häkchen
 * übernommenen Aufgaben, mit dem Anlegenden als Owner (DECISIONS D-059).
 */
export async function createProject(deps: Deps, actor: NamedActor, raw: z.input<typeof projectSchema>) {
  assert(actor.active);
  const input = projectSchema.parse(raw);
  const client = await deps.db.client.findUnique({ where: { id: input.clientId } });
  if (!client || client.status === "ARCHIVIERT") throw new DomainError(t.tasks.errors.clientRequired);
  if (input.agreedServiceId && !(await deps.db.agreedService.findFirst({ where: { id: input.agreedServiceId, clientId: client.id } }))) {
    throw new DomainError(t.tasks.errors.serviceInvalid);
  }
  if (input.startDate && input.endDate && input.endDate < input.startDate) throw new DomainError(t.projects.errors.periodInvalid);
  const suggestions = (SUGGESTING_KINDS as readonly string[]).includes(input.kind) ? input.suggestedTasks : [];
  if (suggestions.length && !input.taskDueAt) throw new DomainError(t.tasks.errors.dueRequired);

  const project = await deps.db.project.create({
    data: {
      clientId: client.id,
      title: input.title,
      kind: input.kind,
      status: "GEPLANT",
      startDate: input.startDate,
      endDate: input.endDate,
      agreedServiceId: input.agreedServiceId,
      createdBy: actor.id,
      updatedBy: actor.id,
    },
  });
  for (const key of suggestions) {
    const suggestion = PROJECT_TASK_SUGGESTIONS.find((s) => s.key === key)!;
    await createTask(deps, actor, {
      clientId: client.id,
      projectId: project.id,
      category: "EVENT",
      type: "DOKUMENT",
      format: key,
      title: `${input.title}: ${suggestion.title}`,
      ownerId: actor.id,
      dueAt: input.taskDueAt!,
    });
  }
  return project;
}

/**
 * Projektstatus (DECISIONS D-007). Wird ein Projekt mit vereinbarter Leistung abgeschlossen,
 * zählt die Leistung um eins hoch (Zählung in clients/services.ts).
 */
export async function setProjectStatus(deps: Deps, actor: NamedActor, projectId: string, status: ProjectStatus) {
  const project = await deps.db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError(t.errors.notFound);
  const ctx = await loadPermissionContext(deps.db, actor.id);
  assert(canEditTask(actor, ctx, { clientId: project.clientId, ownerId: project.createdBy ?? "" }));
  const allowed: Record<ProjectStatus, ProjectStatus[]> = {
    GEPLANT: ["LAUFEND", "ABGEBROCHEN"],
    LAUFEND: ["ABGESCHLOSSEN", "ABGEBROCHEN"],
    ABGESCHLOSSEN: ["LAUFEND"],
    ABGEBROCHEN: ["GEPLANT"],
  };
  if (!allowed[project.status].includes(status)) throw new DomainError(t.projects.errors.statusInvalid);
  return deps.db.project.update({ where: { id: projectId }, data: { status, updatedBy: actor.id } });
}

export function listProjects(deps: Pick<Deps, "db">, clientId: string | null) {
  return deps.db.project.findMany({
    where: { clientId: clientId ?? undefined },
    include: {
      client: { select: { name: true } },
      agreedService: { select: { title: true } },
      tasks: { select: { id: true, title: true, status: true, ownerId: true } },
    },
    orderBy: [{ status: "asc" }, { startDate: "asc" }, { title: "asc" }],
  });
}
