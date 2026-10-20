import { Placeholder } from "@/components/layout/placeholder";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { selectedClientName } from "@/lib/domain/clients/current";
import { requireUser } from "@/lib/session";

export default async function Page() {
  const user = await requireUser();
  const area = t.areas.pressespiegel;
  return <Placeholder title={area.title} phase={area.phase} clientName={await selectedClientName(prisma, user.selectedClientId)} />;
}
