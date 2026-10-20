"use client";

import {
  createShiftTypeAction,
  createUserAction,
  grantPermissionAction,
  revokePermissionAction,
  setUserActiveAction,
  setUserRoleAction,
  updateShiftTypeAction,
} from "@/app/(app)/verwaltung/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { t } from "@/i18n";
import type { Role } from "@/lib/generated/prisma/enums";

type Option = { id: string; name: string };
const u = t.admin.users;

export function NewUserForm() {
  return (
    <ActionForm action={createUserAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto_auto] sm:items-end">
      <Field label={u.name} htmlFor="nu-name"><Input id="nu-name" name="name" required /></Field>
      <Field label={u.email} htmlFor="nu-email" hint={u.emailHint}><Input id="nu-email" name="email" type="email" required /></Field>
      <Field label={u.role} htmlFor="nu-role">
        <Select id="nu-role" name="role" defaultValue="REDAKTEUR">
          <option value="REDAKTEUR">{t.common.roles.REDAKTEUR}</option>
          <option value="CVD">{t.common.roles.CVD}</option>
        </Select>
      </Field>
      <div className="pb-2"><Checkbox label={u.admin} name="isAdmin" /></div>
      <SubmitButton>{u.create}</SubmitButton>
    </ActionForm>
  );
}

export function RoleForm({ userId, role, isAdmin }: { userId: string; role: Role; isAdmin: boolean }) {
  return (
    <ActionForm action={setUserRoleAction.bind(null, userId)} className="flex flex-wrap items-end gap-3">
      <Field label={u.role} htmlFor="r-role">
        <Select id="r-role" name="role" defaultValue={role}>
          <option value="REDAKTEUR">{t.common.roles.REDAKTEUR}</option>
          <option value="CVD">{t.common.roles.CVD}</option>
        </Select>
      </Field>
      <div className="pb-2"><Checkbox label={u.admin} name="isAdmin" defaultChecked={isAdmin} /></div>
      <SubmitButton variant="outline">{u.saveRole}</SubmitButton>
    </ActionForm>
  );
}

export function ActiveToggle({ userId, active }: { userId: string; active: boolean }) {
  return (
    <ActionForm action={setUserActiveAction.bind(null, userId, !active)}>
      <SubmitButton size="sm" variant={active ? "destructive" : "outline"}>{active ? u.block : u.unblock}</SubmitButton>
    </ActionForm>
  );
}

export function GrantForm({ userId, clients, allowSelfApprove }: { userId: string; clients: Option[]; allowSelfApprove: boolean }) {
  const g = t.admin.grants;
  return (
    <ActionForm action={grantPermissionAction.bind(null, userId)} className="flex flex-wrap items-end gap-3">
      <Field label={g.permission} htmlFor="g-perm">
        <Select id="g-perm" name="permission" defaultValue="APPROVE">
          <option value="APPROVE">{g.labels.APPROVE}</option>
          <option value="CREATE_TASKS_FOR_OTHERS">{g.labels.CREATE_TASKS_FOR_OTHERS}</option>
          {allowSelfApprove && <option value="SELF_APPROVE">{g.labels.SELF_APPROVE}</option>}
        </Select>
      </Field>
      <Field label={g.client} htmlFor="g-client">
        <Select id="g-client" name="clientId" defaultValue="">
          <option value="">{g.allClients}</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <SubmitButton variant="outline">{g.add}</SubmitButton>
      {allowSelfApprove && <p className="w-full text-xs text-muted-foreground">{g.selfApproveHint}</p>}
    </ActionForm>
  );
}

export function RevokeGrantButton({ grantId }: { grantId: string }) {
  return (
    <ActionForm action={revokePermissionAction.bind(null, grantId)}>
      <SubmitButton size="sm" variant="ghost">{t.admin.grants.revoke}</SubmitButton>
    </ActionForm>
  );
}

type ShiftTypeValues = { name: string; defaultStart: string; defaultEnd: string; weekdays: number[]; createsTask: boolean };

export function ShiftTypeForm({ id, values }: { id?: string; values?: ShiftTypeValues }) {
  const s = t.shifts.types;
  const prefix = id ?? "neu";
  return (
    <ActionForm action={id ? updateShiftTypeAction.bind(null, id) : createShiftTypeAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={s.name} htmlFor={`st-name-${prefix}`}><Input id={`st-name-${prefix}`} name="name" required defaultValue={values?.name} /></Field>
        <Field label={s.start} htmlFor={`st-start-${prefix}`}><Input id={`st-start-${prefix}`} name="defaultStart" type="time" required defaultValue={values?.defaultStart ?? "08:00"} /></Field>
        <Field label={s.end} htmlFor={`st-end-${prefix}`}><Input id={`st-end-${prefix}`} name="defaultEnd" type="time" required defaultValue={values?.defaultEnd ?? "18:00"} /></Field>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">{s.weekdays}</legend>
        <div className="flex flex-wrap gap-3">
          {t.shifts.weekdayShort.map((label, i) => (
            <Checkbox key={label} label={label} name="weekdays" value={String(i + 1)} defaultChecked={values ? values.weekdays.includes(i + 1) : i < 5} />
          ))}
        </div>
      </fieldset>
      <Checkbox label={s.createsTask} name="createsTask" defaultChecked={values?.createsTask ?? false} />
      <div><SubmitButton variant={id ? "outline" : "default"}>{id ? s.save : s.add}</SubmitButton></div>
    </ActionForm>
  );
}
