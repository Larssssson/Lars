import { notFound } from "next/navigation";
import { updateAiModelsAction } from "@/app/(app)/verwaltung/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { canManageTechnicalSettings } from "@/lib/domain/permissions";
import { aiModelSettings } from "@/lib/domain/settings";
import { checkServices } from "@/lib/server/health";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Integrationen und KI (BRIEFING 7.10, nur Admin): Status der Dienste und Modellwahl. */
export default async function IntegrationsPage() {
  const user = await requireUser();
  if (!canManageTechnicalSettings(user)) notFound();
  const [results, models] = await Promise.all([checkServices(["auth", "documents", "files", "ai", "push", "database"]), aiModelSettings(prisma)]);
  const i = t.admin.integrations;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{i.intro}</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="integrations">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">{i.service}</th>
              <th scope="col" className="px-3 py-2 font-medium">{i.mode}</th>
              <th scope="col" className="px-3 py-2 font-medium">{i.status}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.name} className="border-t">
                <td className="px-3 py-2 font-medium">{i.names[r.name]}</td>
                <td className="px-3 py-2">{r.mode === "real" ? i.real : i.mock}</td>
                <td className="px-3 py-2">
                  <Badge className={cn(r.ok ? "border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "border-red-400 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100")}>
                    {r.ok ? i.ok : i.failed}
                  </Badge>
                  <span className="ml-2 text-xs text-muted-foreground">{r.detail}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Card>
        <CardTitle className="mb-1">{i.models}</CardTitle>
        <p className="mb-3 text-xs text-muted-foreground">{i.modelsHint}</p>
        <ActionForm action={updateAiModelsAction} className="grid max-w-2xl gap-3 sm:grid-cols-2">
          <Field label={i.quality} htmlFor="m-quality" hint={i.standard(env().AI_MODEL_QUALITY)}>
            <Input id="m-quality" name="quality" defaultValue={models.quality ?? ""} placeholder={env().AI_MODEL_QUALITY} />
          </Field>
          <Field label={i.fast} htmlFor="m-fast" hint={i.standard(env().AI_MODEL_FAST)}>
            <Input id="m-fast" name="fast" defaultValue={models.fast ?? ""} placeholder={env().AI_MODEL_FAST} />
          </Field>
          <div><SubmitButton>{t.admin.settings.save}</SubmitButton></div>
        </ActionForm>
      </Card>
    </div>
  );
}
