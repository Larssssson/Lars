import { notFound } from "next/navigation";
import { NewClientForm } from "@/components/clients/client-forms";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { canManageClients } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";

export default async function NewClientPage() {
  const user = await requireUser();
  if (!canManageClients(user)) notFound();
  const users = await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t.clients.newClient}</h1>
      <NewClientForm users={users} />
    </div>
  );
}
