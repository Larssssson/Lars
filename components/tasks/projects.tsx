"use client";

import Link from "next/link";
import { useState } from "react";
import { createProjectAction, setProjectStatusAction } from "@/app/(app)/redaktion/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { t } from "@/i18n";
import type { ProjectStatus, TaskStatus } from "@/lib/generated/prisma/enums";

type ProjectView = {
  id: string;
  title: string;
  kind: keyof typeof t.projects.kinds;
  status: ProjectStatus;
  period: string;
  service: string | null;
  tasks: { id: string; title: string; status: TaskStatus }[];
};

const NEXT: Record<ProjectStatus, ProjectStatus[]> = {
  GEPLANT: ["LAUFEND", "ABGEBROCHEN"],
  LAUFEND: ["ABGESCHLOSSEN", "ABGEBROCHEN"],
  ABGESCHLOSSEN: ["LAUFEND"],
  ABGEBROCHEN: ["GEPLANT"],
};

/** Projekte des gewählten Kunden (BRIEFING 6.6, 7.2). */
export function ProjectList({ projects }: { projects: ProjectView[] }) {
  const p = t.projects;
  if (projects.length === 0) return <p className="text-sm text-muted-foreground">{p.none}</p>;
  return (
    <ul className="grid gap-3 md:grid-cols-2" data-testid="projects">
      {projects.map((project) => (
        <li key={project.id} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{project.title}</h3>
            <Badge>{p.statuses[project.status]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {p.kinds[project.kind]}{project.period ? ` · ${project.period}` : ""}{project.service ? ` · ${p.counts} ${project.service}` : ""}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {project.tasks.map((task) => (
              <li key={task.id} className="flex justify-between gap-2">
                <Link href={`/aufgaben/${task.id}`} className="hover:underline">{task.title}</Link>
                <span className="text-xs text-muted-foreground">{t.tasks.statuses[task.status]}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {NEXT[project.status].map((status) => (
              <ActionForm key={status} action={setProjectStatusAction.bind(null, project.id, status)}>
                <SubmitButton size="sm" variant="outline">{p.statusActions[status]}</SubmitButton>
              </ActionForm>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProjectForm({ clientId, services, defaultDue }: { clientId: string; services: { id: string; name: string }[]; defaultDue: string }) {
  const p = t.projects;
  const [kind, setKind] = useState<keyof typeof p.kinds>("ROUNDTABLE");
  const suggesting = kind === "ROUNDTABLE" || kind === "PRESSE_EVENT";
  return (
    <ActionForm action={createProjectAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="clientId" value={clientId} />
      <Field label={p.fields.title} htmlFor="p-title"><Input id="p-title" name="title" required /></Field>
      <Field label={p.fields.kind} htmlFor="p-kind">
        <Select id="p-kind" name="kind" value={kind} onChange={(e) => setKind(e.currentTarget.value as keyof typeof p.kinds)}>
          {(Object.keys(p.kinds) as (keyof typeof p.kinds)[]).map((k) => <option key={k} value={k}>{p.kinds[k]}</option>)}
        </Select>
      </Field>
      <Field label={p.fields.start} htmlFor="p-start"><Input id="p-start" name="startDate" type="date" /></Field>
      <Field label={p.fields.end} htmlFor="p-end"><Input id="p-end" name="endDate" type="date" /></Field>
      <Field label={p.fields.service} htmlFor="p-service" optional={t.tasks.optional}>
        <Select id="p-service" name="agreedServiceId" defaultValue="">
          <option value="">{t.tasks.none}</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>
      {suggesting && (
        <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
          <legend className="mb-1 text-sm font-medium">{p.suggestions}</legend>
          <div className="flex flex-wrap gap-4">
            {[["KONZEPT", "Konzept"], ["EINLADUNG", "Einladung"], ["AGENDA", "Agenda"], ["QA", "Q&A"], ["MEDIEN_PITCH", "Pitch"]].map(([key, label]) => (
              <Checkbox key={key} label={label!} name="suggested" value={key} defaultChecked />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{p.suggestionsHint}</p>
          <Field label={p.taskDue} htmlFor="p-due" className="max-w-xs">
            <Input id="p-due" name="taskDueAt" type="datetime-local" defaultValue={defaultDue} />
          </Field>
        </fieldset>
      )}
      <div className="sm:col-span-2"><SubmitButton>{p.create}</SubmitButton></div>
    </ActionForm>
  );
}
