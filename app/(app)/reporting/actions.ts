"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { t } from "@/i18n";
import { approveReport, createReport, deleteReport, updateReport, type ReportInput } from "@/lib/domain/reports/service";
import { runAction, str, type ActionState } from "@/lib/server/action";
import { serverDeps } from "@/lib/server/deps";
import { requireUser } from "@/lib/session";
import { atTime } from "@/lib/time";

/** Tag aus <input type="date"> als Berliner Mitternacht; ungültig ergibt ein ungültiges Datum (Prüfung im Schema). */
const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? atTime(v, "00:00") : new Date(Number.NaN));

const list = (form: FormData, key: string) => (str(form, key) ?? "").split(/\r?\n|;/).map((s) => s.trim()).filter(Boolean);

function input(form: FormData): ReportInput {
  return {
    clientId: str(form, "clientId") ?? "",
    title: str(form, "title"),
    template: (str(form, "template") ?? "KOMPAKT") as ReportInput["template"],
    periodStart: day(str(form, "from")),
    periodEnd: day(str(form, "to")),
    blocks: form.getAll("blocks").map(String) as ReportInput["blocks"],
    clientAliases: list(form, "clientAliases"),
    competitors: list(form, "competitors"),
    tier1: list(form, "tier1"),
    tier2: list(form, "tier2"),
    excludePaid: form.get("excludePaid") === "on",
    topicFilter: list(form, "topicFilter"),
    commentary: str(form, "commentary"),
  };
}

async function upload(form: FormData) {
  const file = form.get("file");
  return file instanceof File && file.size > 0 ? { name: file.name, mimeType: file.type, data: new Uint8Array(await file.arrayBuffer()) } : null;
}

export async function createReportAction(_state: ActionState, form: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    id = (await createReport(serverDeps(), await requireUser(), input(form), await upload(form))).id;
  });
  if (result?.error) return result;
  revalidatePath("/reporting");
  redirect(`/reporting/${id}`);
}

export async function updateReportAction(reportId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await updateReport(serverDeps(), await requireUser(), reportId, input(form), await upload(form));
    return t.common.saved;
  });
  revalidatePath(`/reporting/${reportId}`);
  return result;
}

export async function approveReportAction(reportId: string, approve: boolean, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await approveReport(serverDeps(), await requireUser(), reportId, approve);
  });
  revalidatePath(`/reporting/${reportId}`);
  return result;
}

export async function deleteReportAction(reportId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await deleteReport(serverDeps(), await requireUser(), reportId);
  });
  if (result?.error) return result;
  revalidatePath("/reporting");
  redirect("/reporting");
}
