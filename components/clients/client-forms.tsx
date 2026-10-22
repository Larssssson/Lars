"use client";

import {
  createClientAction,
  removeMembershipAction,
  setClientStatusAction,
  setMembershipAction,
  updateClientAction,
  uploadLogoAction,
} from "@/app/(app)/kunden/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { t } from "@/i18n";
import type { ClientStatus } from "@/lib/generated/prisma/enums";

type Option = { id: string; name: string };
type ClientValues = { name: string; shortName: string; industry: string; cluster: string; aiAllowed: boolean; checkStrictness: string };

function ClientFields({ values }: { values?: ClientValues }) {
  const f = t.clients.fields;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={f.name} htmlFor="c-name"><Input id="c-name" name="name" required defaultValue={values?.name} /></Field>
      <Field label={f.shortName} htmlFor="c-short" hint={t.clients.shortNameHint}>
        <Input id="c-short" name="shortName" required defaultValue={values?.shortName} />
      </Field>
      <Field label={f.industry} htmlFor="c-industry"><Input id="c-industry" name="industry" defaultValue={values?.industry} /></Field>
      <Field label={f.cluster} htmlFor="c-cluster"><Input id="c-cluster" name="cluster" defaultValue={values?.cluster} placeholder="Defence" /></Field>
      <Field label={t.checks.strictness} htmlFor="c-strictness">
        <Select id="c-strictness" name="checkStrictness" defaultValue={values?.checkStrictness ?? "NORMAL"}>
          {Object.entries(t.checks.strictnessLevels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </Select>
      </Field>
      <Checkbox label={f.aiAllowed} name="aiAllowed" defaultChecked={values?.aiAllowed ?? true} />
    </div>
  );
}

export function NewClientForm({ users }: { users: Option[] }) {
  return (
    <ActionForm action={createClientAction} className="flex max-w-2xl flex-col gap-5">
      <ClientFields />
      <Field label={t.clients.fields.lead} htmlFor="c-lead">
        <Select id="c-lead" name="leadUserId" defaultValue="">
          <option value="">{t.tasks.none}</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      </Field>
      <div><SubmitButton>{t.clients.save}</SubmitButton></div>
    </ActionForm>
  );
}

export function EditClientForm({ clientId, values }: { clientId: string; values: ClientValues }) {
  return (
    <ActionForm action={updateClientAction.bind(null, clientId)} className="flex flex-col gap-4">
      <ClientFields values={values} />
      <div><SubmitButton>{t.clients.saveChanges}</SubmitButton></div>
    </ActionForm>
  );
}

export function LogoForm({ clientId }: { clientId: string }) {
  return (
    <ActionForm action={uploadLogoAction.bind(null, clientId)} className="flex flex-wrap items-end gap-2">
      <Field label={t.clients.uploadLogo} htmlFor="c-logo">
        <Input id="c-logo" name="logo" type="file" accept="image/png,image/jpeg" required className="h-auto py-1.5" />
      </Field>
      <SubmitButton variant="outline">{t.clients.uploadLogo}</SubmitButton>
    </ActionForm>
  );
}

export function StatusActions({ clientId, status }: { clientId: string; status: ClientStatus }) {
  const a = t.clients.actions;
  const next: { status: ClientStatus; label: string; confirm?: string }[] =
    status === "ONBOARDING"
      ? [{ status: "AKTIV", label: a.activate }, { status: "ARCHIVIERT", label: a.archive, confirm: t.clients.confirmArchive }]
      : status === "AKTIV"
        ? [{ status: "ARCHIVIERT", label: a.archive, confirm: t.clients.confirmArchive }]
        : [{ status: "ONBOARDING", label: a.restore }];
  return (
    <div className="flex flex-wrap gap-2">
      {next.map((n) => (
        <ActionForm key={n.status} action={setClientStatusAction.bind(null, clientId, n.status)} confirm={n.confirm}>
          <SubmitButton size="sm" variant={n.status === "ARCHIVIERT" ? "destructive" : "outline"}>{n.label}</SubmitButton>
        </ActionForm>
      ))}
    </div>
  );
}

/** Zuordnung setzen: auf der Kundenseite mit Personenwahl, auf der Nutzerseite mit Kundenwahl. */
export function MembershipForm({
  clientId,
  userId,
  users = [],
  clients = [],
}: {
  clientId?: string;
  userId?: string;
  users?: Option[];
  clients?: Option[];
}) {
  return (
    <ActionForm action={setMembershipAction.bind(null, clientId ?? null)} className="flex flex-wrap items-end gap-2">
      {userId ? (
        <input type="hidden" name="userId" value={userId} />
      ) : (
        <Field label={t.shifts.person} htmlFor="m-user">
          <Select id="m-user" name="userId" required defaultValue="">
            <option value="" disabled>{t.tasks.choose}</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </Field>
      )}
      {!clientId && (
        <Field label={t.clients.fields.name} htmlFor="m-client">
          <Select id="m-client" name="clientId" required defaultValue="">
            <option value="" disabled>{t.tasks.choose}</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label={t.admin.memberships.kind} htmlFor="m-kind">
        <Select id="m-kind" name="kind" defaultValue="TEAM">
          <option value="TEAM">{t.common.memberKind.TEAM}</option>
          <option value="LEAD">{t.common.memberKind.LEAD}</option>
        </Select>
      </Field>
      <div className="pb-2"><Checkbox label={t.clients.canApprove} name="canApprove" /></div>
      <SubmitButton variant="outline">{t.admin.memberships.add}</SubmitButton>
    </ActionForm>
  );
}

export function RemoveMembershipButton({ clientId, userId }: { clientId: string; userId: string }) {
  return (
    <ActionForm action={removeMembershipAction.bind(null, clientId, userId)}>
      <SubmitButton size="sm" variant="ghost">{t.admin.memberships.remove}</SubmitButton>
    </ActionForm>
  );
}
