"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { t } from "@/i18n";
import {
  answerOnboardingQuestion,
  confirmSection,
  decideSuggestion,
  deleteDismissalRule,
  deleteKpi,
  deleteService,
  deleteSpeaker,
  generateOnboardingQuestions,
  saveKpi,
  saveService,
  saveSpeaker,
  setOnboardingStep,
  suggestChange,
  updateSection,
  uploadProfileDocument,
} from "@/lib/domain/clients/profile";
import { sectionFields } from "@/lib/domain/clients/profile-sections";
import { DomainError } from "@/lib/domain/errors";
import { bool, runAction, str, type ActionState } from "@/lib/server/action";
import { serverDeps } from "@/lib/server/deps";
import { requireUser } from "@/lib/session";
import { atTime } from "@/lib/time";

const id = z.uuid();
const refresh = (clientId: string) => revalidatePath(`/kunden/${clientId}`, "layout");

/** Felder eines Abschnitts aus dem Formular; nur Felder, die im Formular stehen (Rechte je Feld). */
export async function updateSectionAction(clientId: string, sectionKey: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const values: Record<string, string> = {};
  for (const field of sectionFields(sectionKey)) {
    const v = form.get(field.key);
    if (typeof v === "string") values[field.key] = v;
  }
  const result = await runAction(async () => {
    await updateSection(serverDeps(), await requireUser(), id.parse(clientId), sectionKey, values);
    return t.common.saved;
  });
  refresh(clientId);
  return result;
}

export async function confirmSectionAction(clientId: string, sectionKey: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => confirmSection(serverDeps(), await requireUser(), id.parse(clientId), sectionKey));
  refresh(clientId);
  return result;
}

export async function suggestChangeAction(clientId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const [sectionKey = "", field = ""] = (str(form, "target") ?? "").split(".");
    await suggestChange(serverDeps(), await requireUser(), id.parse(clientId), { sectionKey, field, value: str(form, "value") ?? "" });
    return t.profile.suggestSent;
  });
  refresh(clientId);
  return result;
}

export async function decideSuggestionAction(clientId: string, suggestionId: string, accept: boolean, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => decideSuggestion(serverDeps(), await requireUser(), id.parse(suggestionId), accept));
  refresh(clientId);
  return result;
}

export async function saveSpeakerAction(clientId: string, speakerId: string | null, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await saveSpeaker(serverDeps(), await requireUser(), id.parse(clientId), speakerId, {
      name: str(form, "name") ?? "",
      function: str(form, "function") ?? "",
      topics: (str(form, "topics") ?? "").split(",").map((x) => x.trim()).filter(Boolean),
      quoteNeedsClientApproval: bool(form, "quoteNeedsClientApproval"),
    });
    return t.common.saved;
  });
  refresh(clientId);
  return result;
}

export async function deleteSpeakerAction(clientId: string, speakerId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => deleteSpeaker(serverDeps(), await requireUser(), id.parse(clientId), id.parse(speakerId)));
  refresh(clientId);
  return result;
}

function dateField(form: FormData, key: string, time: string): Date {
  const v = str(form, key);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new DomainError(t.profile.errors.valueRequired);
  return atTime(v, time);
}

export async function saveServiceAction(clientId: string, serviceId: string | null, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await saveService(serverDeps(), await requireUser(), id.parse(clientId), serviceId, {
      title: str(form, "title") ?? "",
      category: (str(form, "category") ?? "SONSTIGES") as never,
      targetCount: Number(str(form, "targetCount") ?? 0),
      periodStart: dateField(form, "periodStart", "00:00"),
      periodEnd: dateField(form, "periodEnd", "23:59"),
    });
    return t.common.saved;
  });
  refresh(clientId);
  return result;
}

export async function deleteServiceAction(clientId: string, serviceId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => deleteService(serverDeps(), await requireUser(), id.parse(clientId), id.parse(serviceId)));
  refresh(clientId);
  return result;
}

export async function saveKpiAction(clientId: string, kpiId: string | null, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await saveKpi(serverDeps(), await requireUser(), id.parse(clientId), kpiId, {
      title: str(form, "title") ?? "",
      target: str(form, "target") ?? "",
      period: str(form, "period") ?? "",
      note: str(form, "note"),
    });
    return t.common.saved;
  });
  refresh(clientId);
  return result;
}

export async function deleteKpiAction(clientId: string, kpiId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => deleteKpi(serverDeps(), await requireUser(), id.parse(clientId), id.parse(kpiId)));
  refresh(clientId);
  return result;
}

export async function deleteRuleAction(clientId: string, ruleId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => deleteDismissalRule(serverDeps(), await requireUser(), id.parse(clientId), id.parse(ruleId)));
  refresh(clientId);
  return result;
}

export async function uploadProfileDocumentAction(clientId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new DomainError(t.profile.errors.valueRequired);
    const out = await uploadProfileDocument(serverDeps(), await requireUser(), id.parse(clientId), {
      sectionKey: str(form, "sectionKey") ?? "dokumente",
      file: { name: file.name, mimeType: file.type || "application/octet-stream", data: new Uint8Array(await file.arrayBuffer()) },
    });
    return [t.profile.documents.uploaded(out.suggestions), out.aiNotice].filter(Boolean).join(" ");
  });
  refresh(clientId);
  return result;
}

export async function generateQuestionsAction(clientId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await generateOnboardingQuestions(serverDeps(), await requireUser(), id.parse(clientId));
  });
  refresh(clientId);
  return result;
}

export async function answerQuestionAction(clientId: string, index: number, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await answerOnboardingQuestion(serverDeps(), await requireUser(), id.parse(clientId), index, str(form, "answer") ?? "");
    return t.common.saved;
  });
  refresh(clientId);
  return result;
}

export async function setOnboardingStepAction(clientId: string, step: string) {
  await setOnboardingStep(serverDeps(), await requireUser(), id.parse(clientId), step);
}
