import { notFound } from "next/navigation";
import { Placeholder } from "@/components/layout/placeholder";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { selectedClientName } from "@/lib/domain/clients/current";
import { canOpenAdministration } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";

export default async function AdministrationPage() {
  const user = await requireUser();
  if (!canOpenAdministration(user)) notFound();
  const area = t.areas.verwaltung;
  return <Placeholder title={area.title} phase={area.phase} clientName={await selectedClientName(prisma, user.selectedClientId)} />;
}
