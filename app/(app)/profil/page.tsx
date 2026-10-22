import { signOutAction } from "@/app/(app)/actions";
import { removeDeviceAction, testPushAction } from "@/app/(app)/profil/actions";
import { PushSetup } from "@/components/account/push-setup";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { adapters } from "@/lib/adapters";
import { prisma } from "@/lib/db";
import { listDevices } from "@/lib/domain/notifications/devices";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/time";

/** Profil (BRIEFING 4): eigene Angaben, Push einrichten mit mehreren Geräten, Abmelden. */
export default async function AccountPage() {
  const user = await requireUser();
  const devices = await listDevices(prisma, user.id);
  const a = t.account;
  const p = a.push;
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">{a.title}</h1>
      <Card>
        <CardTitle className="mb-3">{a.data}</CardTitle>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{a.name}</dt><dd>{user.name}</dd>
          <dt className="text-muted-foreground">{a.email}</dt><dd className="break-all">{user.email}</dd>
          <dt className="text-muted-foreground">{a.role}</dt><dd>{t.common.roles[user.role]}{user.isAdmin ? `, ${a.admin}` : ""}</dd>
        </dl>
      </Card>
      <section id="push" aria-label={p.title} className="scroll-mt-4">
        <Card>
          <CardTitle className="mb-3">{p.title}</CardTitle>
          <PushSetup publicKey={adapters.push().publicKey} />
        </Card>
      </section>
      <Card>
        <CardTitle className="mb-3">{p.devices}</CardTitle>
        {devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{p.noDevices}</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="devices">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <span>{d.deviceLabel ?? p.unnamed} <span className="text-muted-foreground">· {p.since(formatDate(d.createdAt))}</span></span>
                <ActionForm action={removeDeviceAction.bind(null, d.id)}>
                  <SubmitButton size="sm" variant="ghost" aria-label={`${p.remove}: ${d.deviceLabel ?? p.unnamed}`}>{p.remove}</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={testPushAction} className="mt-3">
          <SubmitButton size="sm" variant="outline" disabled={devices.length === 0}>{p.test}</SubmitButton>
        </ActionForm>
      </Card>
      <form action={signOutAction}>
        <Button type="submit" variant="outline">{a.signOut}</Button>
      </form>
    </div>
  );
}
