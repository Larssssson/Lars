"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { t } from "@/i18n";
import {
  approvePendingOwner,
  becomeOwner,
  createContact,
  revealDetail,
  revokeVerification,
  saveMedia,
  setRelation,
  updateContact,
  verifyContact,
  type RevealContext,
} from "@/lib/domain/journo/contacts";
import {
  commitContactImport,
  defaultDecision,
  guessMapping,
  IMPORT_FIELDS,
  loadImportFile,
  previewContactImport,
  uploadContactFile,
  type ImportDecision,
  type ImportRow,
  type Mapping,
} from "@/lib/domain/journo/import";
import { deleteContact } from "@/lib/domain/journo/privacy";
import { createContactRequest, decideContactRequest, type RequestDecision } from "@/lib/domain/journo/requests";
import { suggestJournalists, toggleBookmark } from "@/lib/domain/journo/suggestions";
import { DomainError } from "@/lib/domain/errors";
import { runAction, str, type ActionState } from "@/lib/server/action";
import { serverDeps } from "@/lib/server/deps";
import { requireUser } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

const id = z.uuid();
const refresh = () => revalidatePath("/journo-hub", "layout");
const list = (value: string | null) => (value ?? "").split(",").map((x) => x.trim()).filter(Boolean);

function contactInput(form: FormData) {
  const first = str(form, "firstContactAt");
  return {
    firstName: str(form, "firstName") ?? "",
    lastName: str(form, "lastName") ?? "",
    mediaId: str(form, "mediaId"),
    desk: str(form, "desk"),
    function: str(form, "function"),
    topics: list(str(form, "topics")),
    region: str(form, "region"),
    notes: str(form, "notes"),
    firstContactAt: first && /^\d{4}-\d{2}-\d{2}$/.test(first) ? new Date(`${first}T12:00:00.000Z`) : null,
  };
}

/** Nur ausgefüllte Felder; ein leeres Feld lässt die Angabe unverändert (vorhandene Werte stehen nie im Formular). */
function detailsInput(form: FormData) {
  const get = (key: string) => str(form, key) ?? undefined;
  return { phone: get("phone"), mail: get("mail"), linkedin: get("linkedin"), x: get("x") };
}

/** Freigabe-Kontext: Kunde in der Kopfzeile oder die Aufgabe, aus der der Kontakt geöffnet wurde (DECISIONS D-012). */
async function revealContext(taskId: string | null | undefined): Promise<RevealContext> {
  const user = await requireUser();
  if (taskId && id.safeParse(taskId).success) {
    const { prisma } = await import("@/lib/db");
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { clientId: true, projectId: true } });
    if (task) return { clientId: task.clientId, projectId: task.projectId };
  }
  return { clientId: user.selectedClientId };
}

export async function createContactAction(_state: ActionState, form: FormData): Promise<ActionState> {
  let newId = "";
  const result = await runAction(async () => {
    newId = (await createContact(serverDeps(), await requireUser(), contactInput(form), detailsInput(form))).id;
  });
  if (result?.error) return result;
  refresh();
  redirect(`/journo-hub/${newId}`);
}

export async function updateContactAction(journalistId: string, taskId: string | null, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await updateContact(serverDeps(), await requireUser(), id.parse(journalistId), contactInput(form), detailsInput(form), await revealContext(taskId));
    return t.common.saved;
  });
  refresh();
  return result;
}

export async function revealAction(detailId: string, taskId: string | null): Promise<{ value?: string; error?: string }> {
  let value: string | undefined;
  const result = await runAction(async () => {
    value = await revealDetail(serverDeps(), await requireUser(), id.parse(detailId), await revealContext(taskId));
  });
  return result?.error ? { error: result.error } : { value };
}

export async function verifyAction(journalistId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await verifyContact(serverDeps(), await requireUser(), id.parse(journalistId));
    return t.journo.verified;
  });
  refresh();
  return result;
}

export async function revokeAction(journalistId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => revokeVerification(serverDeps(), await requireUser(), id.parse(journalistId), str(form, "reason") ?? ""));
  refresh();
  return result;
}

export async function becomeOwnerAction(journalistId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    const { pending } = await becomeOwner(serverDeps(), await requireUser(), id.parse(journalistId));
    return pending ? t.journo.ownerLimit : t.common.saved;
  });
  refresh();
  return result;
}

export async function approveOwnerAction(ownerId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => approvePendingOwner(serverDeps(), await requireUser(), id.parse(ownerId)));
  refresh();
  return result;
}

export async function relationAction(journalistId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await setRelation(serverDeps(), await requireUser(), id.parse(journalistId), {
      relationNote: str(form, "relationNote"),
      relationQuality: (str(form, "relationQuality") as "GUT" | "NEUTRAL" | "SCHWIERIG" | null) ?? null,
    });
    return t.common.saved;
  });
  refresh();
  return result;
}

export async function deleteContactAction(journalistId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => deleteContact(serverDeps(), await requireUser(), id.parse(journalistId)));
  if (result?.error) return result;
  refresh();
  redirect("/journo-hub");
}

export async function saveMediaAction(mediaId: string | null, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await saveMedia(serverDeps(), await requireUser(), mediaId, {
      name: str(form, "name") ?? "",
      type: (str(form, "type") ?? "ONLINE") as never,
      desks: list(str(form, "desks")),
    });
    return t.common.saved;
  });
  refresh();
  return result;
}

export async function requestContactAction(journalistId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await createContactRequest(serverDeps(), await requireUser(), {
      journalistId: id.parse(journalistId),
      clientId: str(form, "clientId") ?? "",
      projectId: str(form, "projectId"),
      taskId: str(form, "taskId"),
      reason: str(form, "reason") ?? "",
      urgency: str(form, "urgency") === "DRINGEND" ? "DRINGEND" : "NORMAL",
    });
    return t.journo.request.sent;
  });
  refresh();
  return result;
}

export async function decideRequestAction(requestId: string, decision: RequestDecision, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => decideContactRequest(serverDeps(), await requireUser(), id.parse(requestId), decision, str(form, "note")));
  refresh();
  return result;
}

// ------------------------------------------------------------- Import

export type ImportStep = {
  error?: string;
  fileId?: string;
  fileName?: string;
  columns?: string[];
  sample?: Record<string, string>[];
  mapping?: Mapping;
  rows?: (ImportRow & { decision: ImportDecision })[];
  done?: string;
};

export async function uploadImportAction(_state: ImportStep, form: FormData): Promise<ImportStep> {
  let out: ImportStep = {};
  const result = await runAction(async () => {
    const user = await requireUser();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new DomainError(t.journo.errors.fileType);
    const deps = serverDeps();
    const stored = await uploadContactFile(deps, user, { name: file.name, mimeType: file.type, data: new Uint8Array(await file.arrayBuffer()) });
    const { parsed } = await loadImportFile(deps, user, stored.id);
    out = { fileId: stored.id, fileName: stored.name, columns: parsed.columns, sample: parsed.rows.slice(0, 3), mapping: guessMapping(parsed.columns) };
  });
  return result?.error ? { error: result.error } : out;
}

function mappingFrom(form: FormData, columns: string[]): Mapping {
  const mapping: Mapping = {};
  columns.forEach((column, i) => {
    const value = String(form.get(`map-${i}`) ?? "");
    mapping[column] = (IMPORT_FIELDS as readonly string[]).includes(value) ? (value as Mapping[string]) : "";
  });
  return mapping;
}

export async function previewImportAction(state: ImportStep, form: FormData): Promise<ImportStep> {
  let out: ImportStep = state;
  const result = await runAction(async () => {
    const mapping = mappingFrom(form, state.columns ?? []);
    const rows = await previewContactImport(serverDeps(), await requireUser(), id.parse(state.fileId), mapping);
    out = { ...state, error: undefined, mapping, rows: rows.map((r) => ({ ...r, decision: defaultDecision(r) })) };
  });
  return result?.error ? { ...state, error: result.error } : out;
}

export async function commitImportAction(state: ImportStep, form: FormData): Promise<ImportStep> {
  let done = "";
  const result = await runAction(async () => {
    const decisions: Record<number, ImportDecision> = {};
    for (const row of state.rows ?? []) {
      const value = String(form.get(`decision-${row.index}`) ?? "");
      if (value === "MERGE" || value === "SKIP" || value === "NEW") decisions[row.index] = value;
    }
    const counts = await commitContactImport(serverDeps(), await requireUser(), {
      fileId: id.parse(state.fileId),
      mapping: state.mapping ?? {},
      decisions,
      mappingName: str(form, "mappingName"),
    });
    done = t.journo.import.done(counts.created, counts.merged, counts.skipped);
  });
  refresh();
  return result?.error ? { ...state, error: result.error } : { done };
}

// ------------------------------------------------------------- Reiter Journalisten im Editor

export type SuggestionsResult = Awaited<ReturnType<typeof suggestJournalists>> & { embargo: string | null; error?: string };

export async function journalistSuggestionsAction(taskId: string): Promise<SuggestionsResult | { error: string }> {
  try {
    const result = await suggestJournalists(serverDeps(), await requireUser(), id.parse(taskId));
    return { ...result, embargo: result.embargoAt ? formatDateTime(result.embargoAt) : null };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

export async function toggleBookmarkAction(taskId: string, journalistId: string): Promise<boolean> {
  const result = await toggleBookmark(serverDeps(), await requireUser(), id.parse(taskId), id.parse(journalistId));
  revalidatePath(`/aufgaben/${taskId}`);
  return result;
}

/** Ein Zustand für alle vier Schritte des Imports; das Formularfeld "step" wählt den Schritt. */
export async function importWizardAction(state: ImportStep, form: FormData): Promise<ImportStep> {
  const step = str(form, "step");
  if (step === "upload") return uploadImportAction(state, form);
  if (step === "preview") return previewImportAction(state, form);
  if (step === "commit") return commitImportAction(state, form);
  return {};
}
