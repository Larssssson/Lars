import { ImportWizard } from "@/components/journo/import-wizard";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function ImportPage() {
  await requireUser();
  const mappings = await prisma.importMapping.findMany({ where: { kind: "KONTAKTE" }, orderBy: { name: "asc" } });
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t.journo.import.title}</h2>
      <ImportWizard savedMappings={mappings.map((m) => ({ id: m.id, name: m.name, mapping: m.mapping as Record<string, string> }))} />
    </div>
  );
}
