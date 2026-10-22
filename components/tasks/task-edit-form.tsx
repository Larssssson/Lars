"use client";

import { updateTaskAction } from "@/app/(app)/aufgaben/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { t } from "@/i18n";

type Option = { id: string; name: string };

export function TaskEditForm(props: {
  taskId: string;
  title: string;
  description: string;
  dueAt: string;
  embargoAt: string;
  ownerId: string;
  preferredApproverId: string;
  owners: Option[];
  approvers: Option[];
}) {
  const f = t.tasks.fields;
  return (
    <ActionForm action={updateTaskAction.bind(null, props.taskId)} className="flex flex-col gap-4">
      <Field label={f.title} htmlFor="edit-title">
        <Input id="edit-title" name="title" defaultValue={props.title} required maxLength={200} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={f.due} htmlFor="edit-due">
          <Input id="edit-due" name="dueAt" type="datetime-local" defaultValue={props.dueAt} required />
        </Field>
        <Field label={f.embargo} htmlFor="edit-embargo" optional={t.tasks.optional}>
          <Input id="edit-embargo" name="embargoAt" type="datetime-local" defaultValue={props.embargoAt} />
        </Field>
        <Field label={f.owner} htmlFor="edit-owner">
          <Select id="edit-owner" name="ownerId" defaultValue={props.ownerId}>
            {props.owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={f.preferredApprover} htmlFor="edit-approver" optional={t.tasks.optional}>
          <Select id="edit-approver" name="preferredApproverId" defaultValue={props.preferredApproverId}>
            <option value="">{t.tasks.none}</option>
            {props.approvers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={f.description} htmlFor="edit-description" optional={t.tasks.optional}>
        <Textarea id="edit-description" name="description" defaultValue={props.description} maxLength={5000} />
      </Field>
      <div>
        <SubmitButton>{t.tasks.saveChanges}</SubmitButton>
      </div>
    </ActionForm>
  );
}
