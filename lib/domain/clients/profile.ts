import { z } from "zod";
import { t } from "@/i18n";
import { AiNotAllowedError, AiOutputError, AiUnavailableError } from "@/lib/ai/errors";
import type { ProfileSuggestionOutput } from "@/lib/ai/schemas";
import { aiAllowedFor, callAi } from "@/lib/ai/service";
import type { Deps } from "@/lib/domain/deps";
import { clientFolder } from "@/lib/domain/documents/filing";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { assert, canEditProfilePart, canManageGoalsKpisServices, profileAccess, type NamedActor } from "@/lib/domain/permissions";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { extractDocumentText } from "./extract-text";
import {
  DEFAULT_UPLOAD_FOLDER,
  PROFILE_SECTIONS,
  sectionDef,
  sectionFields,
  UPLOAD_FOLDER,
  type Fact,
  type SectionContent,
} from "./profile-sections";

const uuid = z.uuid();

async function requireClient(db: PrismaClient, clientId: string) {
  if (!uuid.safeParse(clientId).success) throw new NotFoundError(t.errors.notFound);
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) throw new NotFoundError(t.errors.notFound);
  return client;
}

/** Bearbeitungsteil eines Felds für canEditProfilePart (DECISIONS D-010). */
function partOf(sectionKey: string, fieldKey: string): string {
  return sectionFields(sectionKey).find((f) => f.key === fieldKey)?.part ?? sectionKey;
}

export async function loadProfile(db: PrismaClient, clientId: string) {
  const [client, sections, speakers, services, kpis, rules, suggestions, files, finalTexts] = await Promise.all([
    requireClient(db, clientId),
    db.clientProfileSection.findMany({ where: { clientId } }),
    db.speaker.findMany({ where: { clientId }, orderBy: { name: "asc" } }),
    db.agreedService.findMany({ where: { clientId }, orderBy: { periodEnd: "asc" } }),
    db.kpi.findMany({ where: { clientId }, orderBy: { title: "asc" } }),
    db.dismissalRule.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
    db.profileSuggestion.findMany({ where: { clientId, status: "OFFEN" }, orderBy: { createdAt: "asc" } }),
    db.file.findMany({ where: { clientId, profileSection: { not: null } }, orderBy: { createdAt: "desc" } }),
    finalTextsFor(db, clientId, 20),
  ]);
  const byKey = new Map(sections.map((s) => [s.key, s]));
  return {
    client,
    sections: PROFILE_SECTIONS.map((def) => ({
      def,
      row: byKey.get(def.key) ?? null,
      content: ((byKey.get(def.key)?.content ?? {}) as SectionContent),
    })),
    speakers,
    services,
    kpis,
    rules,
    suggestions,
    files,
    finalTexts,
    onboarding: ((byKey.get("onboarding")?.content ?? {}) as OnboardingState),
  };
}

/** Finale Texte des Kunden (erledigt, im Kundenprofil unter Dokumente, BRIEFING 6.5, 7.7). */
export function finalTextsFor(db: PrismaClient, clientId: string, take = 5) {
  return db.task.findMany({
    where: { clientId, type: "DOKUMENT", status: { in: ["ERLEDIGT", "ARCHIVIERT"] } },
    include: { document: { select: { id: true, title: true, format: true, documentFormat: { select: { name: true } } } } },
    orderBy: { completedAt: "desc" },
    take,
  });
}

/** Feldwerte aus einem Formular normalisieren: Listen zeilenweise, Fakten "Text | Quelle | Datum". */
export function normalizeField(type: "text" | "list" | "facts", raw: string): string | string[] | Fact[] {
  if (type === "text") return raw.trim();
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (type === "list") return lines;
  return lines.map((line) => {
    const [text = "", source, date] = line.split("|").map((p) => p.trim());
    return { text, ...(source ? { source } : {}), ...(date ? { date } : {}) };
  });
}

/**
 * Abschnitt bearbeiten (BRIEFING 7.7). Nur Felder, die der Nutzer bearbeiten darf; Speichern gilt
 * als Bestätigung des Abschnitts (DECISIONS D-067).
 */
export async function updateSection(deps: Deps, actor: NamedActor, clientId: string, sectionKey: string, values: Record<string, string>) {
  await requireClient(deps.db, clientId);
  const fields = sectionFields(sectionKey);
  if (fields.length === 0) throw new NotFoundError(t.errors.notFound);
  const ctx = await loadPermissionContext(deps.db, actor.id);
  const existing = await deps.db.clientProfileSection.findUnique({ where: { clientId_key: { clientId, key: sectionKey } } });
  const content: SectionContent = { ...((existing?.content ?? {}) as SectionContent) };
  let changed = 0;
  for (const field of fields) {
    if (!(field.key in values)) continue;
    assert(canEditProfilePart(actor, ctx, clientId, partOf(sectionKey, field.key)));
    content[field.key] = normalizeField(field.type, values[field.key] ?? "");
    changed += 1;
  }
  if (changed === 0) throw new DomainError(t.profile.errors.nothingToSave);
  const now = deps.now();
  await deps.db.clientProfileSection.upsert({
    where: { clientId_key: { clientId, key: sectionKey } },
    update: { content: content as Prisma.InputJsonValue, confirmedAt: now, confirmedBy: actor.id, updatedBy: actor.id },
    create: { clientId, key: sectionKey, content: content as Prisma.InputJsonValue, confirmedAt: now, confirmedBy: actor.id, createdBy: actor.id, updatedBy: actor.id },
  });
}

/** Bestätigung eines Abschnitts setzen, z. B. nach dem Speichern von Sprechern oder Leistungen (DECISIONS D-067). */
export async function touchSection(db: PrismaClient, clientId: string, key: string, actorId: string, now: Date) {
  await db.clientProfileSection.upsert({
    where: { clientId_key: { clientId, key } },
    update: { confirmedAt: now, confirmedBy: actorId, updatedBy: actorId },
    create: { clientId, key, content: {}, confirmedAt: now, confirmedBy: actorId, createdBy: actorId, updatedBy: actorId },
  });
}

/** Abschnitt unverändert bestätigen ("bestätigt am", BRIEFING 7.7). */
export async function confirmSection(deps: Deps, actor: NamedActor, clientId: string, sectionKey: string) {
  await requireClient(deps.db, clientId);
  if (!sectionDef(sectionKey)) throw new NotFoundError(t.errors.notFound);
  const ctx = await loadPermissionContext(deps.db, actor.id);
  const parts = sectionFields(sectionKey).map((f) => partOf(sectionKey, f.key));
  const allowed = (parts.length ? parts : [sectionKey]).some((part) => canEditProfilePart(actor, ctx, clientId, part));
  assert(allowed);
  await touchSection(deps.db, clientId, sectionKey, actor.id, deps.now());
}

// ------------------------------------------------------------- Vorschläge (lernendes Profil, BRIEFING 7.7)

/** Vorschlag eines Redakteurs: Redakteure bearbeiten nicht, sie schlagen vor (BRIEFING 3.3). */
export async function suggestChange(deps: Deps, actor: NamedActor, clientId: string, input: { sectionKey: string; field: string; value: string }) {
  await requireClient(deps.db, clientId);
  const ctx = await loadPermissionContext(deps.db, actor.id);
  assert(profileAccess(actor, ctx, clientId) !== "NONE");
  const field = sectionFields(input.sectionKey).find((f) => f.key === input.field);
  const isSpeaker = input.sectionKey === "sprecher";
  if (!field && !isSpeaker) throw new DomainError(t.profile.errors.fieldInvalid);
  const value = input.value.trim();
  if (!value) throw new DomainError(t.profile.errors.valueRequired);
  return deps.db.profileSuggestion.create({
    data: {
      clientId,
      sectionKey: input.sectionKey,
      proposedChange: { field: isSpeaker ? "sprecher" : input.field, value: isSpeaker ? { name: value, function: "", topics: [] } : field?.type === "facts" ? { text: value } : value },
      source: "MENSCH",
      createdBy: actor.id,
      updatedBy: actor.id,
    },
  });
}

/** KI-Vorschläge speichern; unbekannte Abschnitte oder Felder werden verworfen. */
async function storeAiSuggestions(
  deps: Deps,
  clientId: string,
  suggestions: ProfileSuggestionOutput[],
  meta: { model: string; promptVersion: string; sourceFileId?: string; sourceDocumentId?: string; actorId: string | null },
): Promise<number> {
  let stored = 0;
  for (const s of suggestions) {
    const valid = s.sectionKey === "sprecher" ? typeof s.value === "object" && "name" in s.value : sectionFields(s.sectionKey).some((f) => f.key === s.field);
    if (!valid) continue;
    await deps.db.profileSuggestion.create({
      data: {
        clientId,
        sectionKey: s.sectionKey,
        proposedChange: { field: s.field, value: s.value, note: s.note ?? null } as Prisma.InputJsonValue,
        source: "KI",
        model: meta.model,
        promptVersion: meta.promptVersion,
        sourceFileId: meta.sourceFileId ?? null,
        sourceDocumentId: meta.sourceDocumentId ?? null,
        createdBy: meta.actorId,
      },
    });
    stored += 1;
  }
  return stored;
}

/** Vorschlag annehmen oder ablehnen; ohne Annahme ändert sich das Profil nicht (BRIEFING 7.7). */
export async function decideSuggestion(deps: Deps, actor: NamedActor, suggestionId: string, accept: boolean) {
  if (!uuid.safeParse(suggestionId).success) throw new NotFoundError(t.errors.notFound);
  const suggestion = await deps.db.profileSuggestion.findUnique({ where: { id: suggestionId } });
  if (!suggestion || suggestion.status !== "OFFEN") throw new NotFoundError(t.errors.notFound);
  const change = suggestion.proposedChange as { field: string; value: unknown };
  const ctx = await loadPermissionContext(deps.db, actor.id);
  assert(canEditProfilePart(actor, ctx, suggestion.clientId, partOf(suggestion.sectionKey, change.field)));
  const now = deps.now();
  await deps.db.$transaction(async (tx) => {
    if (accept) {
      if (suggestion.sectionKey === "sprecher") {
        const v = change.value as { name: string; function?: string; topics?: string[] };
        await tx.speaker.create({ data: { clientId: suggestion.clientId, name: v.name, function: v.function ?? "", topics: v.topics ?? [], createdBy: actor.id } });
      } else {
        const field = sectionFields(suggestion.sectionKey).find((f) => f.key === change.field);
        if (!field) throw new DomainError(t.profile.errors.fieldInvalid);
        const row = await tx.clientProfileSection.findUnique({ where: { clientId_key: { clientId: suggestion.clientId, key: suggestion.sectionKey } } });
        const content = { ...((row?.content ?? {}) as SectionContent) };
        const current = content[field.key];
        if (field.type === "text") {
          const text = typeof change.value === "string" ? change.value : String((change.value as Fact).text ?? "");
          content[field.key] = typeof current === "string" && current.trim() ? `${current}\n${text}` : text;
        } else if (field.type === "list") {
          const list = Array.isArray(current) ? (current as string[]) : [];
          const text = typeof change.value === "string" ? change.value : String((change.value as Fact).text ?? "");
          content[field.key] = list.includes(text) ? list : [...list, text];
        } else {
          const facts = Array.isArray(current) ? (current as Fact[]) : [];
          const fact = typeof change.value === "string" ? { text: change.value } : (change.value as Fact);
          content[field.key] = [...facts, fact];
        }
        await tx.clientProfileSection.upsert({
          where: { clientId_key: { clientId: suggestion.clientId, key: suggestion.sectionKey } },
          update: { content: content as Prisma.InputJsonValue, updatedBy: actor.id },
          create: { clientId: suggestion.clientId, key: suggestion.sectionKey, content: content as Prisma.InputJsonValue, createdBy: actor.id },
        });
      }
    }
    await tx.profileSuggestion.update({
      where: { id: suggestion.id },
      data: { status: accept ? "ANGENOMMEN" : "ABGELEHNT", decidedBy: actor.id, decidedAt: now },
    });
  });
}

// ------------------------------------------------------------- Sprecher, Leistungen, KPIs, Verwerfungsregeln

export const speakerSchema = z.object({
  name: z.string().trim().min(1, t.profile.errors.valueRequired).max(200),
  function: z.string().trim().max(200).default(""),
  topics: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  quoteNeedsClientApproval: z.boolean().default(false),
});

async function assertSpeakerRights(deps: Deps, actor: NamedActor, clientId: string) {
  const ctx = await loadPermissionContext(deps.db, actor.id);
  assert(canEditProfilePart(actor, ctx, clientId, "sprecher"));
}

export async function saveSpeaker(deps: Deps, actor: NamedActor, clientId: string, speakerId: string | null, raw: z.input<typeof speakerSchema>) {
  await requireClient(deps.db, clientId);
  await assertSpeakerRights(deps, actor, clientId);
  const input = speakerSchema.parse(raw);
  await touchSection(deps.db, clientId, "sprecher", actor.id, deps.now());
  if (speakerId) {
    const speaker = await deps.db.speaker.findFirst({ where: { id: speakerId, clientId } });
    if (!speaker) throw new NotFoundError(t.errors.notFound);
    return deps.db.speaker.update({ where: { id: speakerId }, data: { ...input, updatedBy: actor.id } });
  }
  return deps.db.speaker.create({ data: { ...input, clientId, createdBy: actor.id, updatedBy: actor.id } });
}

export async function deleteSpeaker(deps: Deps, actor: NamedActor, clientId: string, speakerId: string) {
  await assertSpeakerRights(deps, actor, clientId);
  await deps.db.speaker.deleteMany({ where: { id: speakerId, clientId } });
}

export const serviceSchema = z.object({
  title: z.string().trim().min(1, t.profile.errors.valueRequired).max(160),
  category: z.enum(["PRESSEMITTEILUNG", "MEDIEN_PITCH", "HINTERGRUNDGESPRAECH", "ROUNDTABLE", "PRESSE_EVENT", "LINKEDIN", "SONSTIGES"]),
  targetCount: z.number().int().min(1).max(1000),
  periodStart: z.date(),
  periodEnd: z.date(),
});

/** Vereinbarte Leistungen und KPIs pflegt nur der CVD (BRIEFING 3.3, 6.8). */
export async function saveService(deps: Deps, actor: NamedActor, clientId: string, serviceId: string | null, raw: z.input<typeof serviceSchema>) {
  assert(canManageGoalsKpisServices(actor));
  await requireClient(deps.db, clientId);
  const input = serviceSchema.parse(raw);
  if (input.periodEnd < input.periodStart) throw new DomainError(t.projects.errors.periodInvalid);
  await touchSection(deps.db, clientId, "vereinbarte_leistungen", actor.id, deps.now());
  if (serviceId) {
    return deps.db.agreedService.update({ where: { id: serviceId, clientId }, data: { ...input, updatedBy: actor.id } });
  }
  return deps.db.agreedService.create({ data: { ...input, clientId, createdBy: actor.id, updatedBy: actor.id } });
}

export async function deleteService(deps: Deps, actor: NamedActor, clientId: string, serviceId: string) {
  assert(canManageGoalsKpisServices(actor));
  await deps.db.agreedService.deleteMany({ where: { id: serviceId, clientId } });
}

export const kpiSchema = z.object({
  title: z.string().trim().min(1, t.profile.errors.valueRequired).max(160),
  target: z.string().trim().min(1, t.profile.errors.valueRequired).max(100),
  period: z.string().trim().min(1, t.profile.errors.valueRequired).max(100),
  note: z.string().trim().max(500).nullish().transform((v) => v || null),
});

export async function saveKpi(deps: Deps, actor: NamedActor, clientId: string, kpiId: string | null, raw: z.input<typeof kpiSchema>) {
  assert(canManageGoalsKpisServices(actor));
  await requireClient(deps.db, clientId);
  const input = kpiSchema.parse(raw);
  await touchSection(deps.db, clientId, "kpis", actor.id, deps.now());
  if (kpiId) return deps.db.kpi.update({ where: { id: kpiId, clientId }, data: { ...input, updatedBy: actor.id } });
  return deps.db.kpi.create({ data: { ...input, clientId, createdBy: actor.id, updatedBy: actor.id } });
}

export async function deleteKpi(deps: Deps, actor: NamedActor, clientId: string, kpiId: string) {
  assert(canManageGoalsKpisServices(actor));
  await deps.db.kpi.deleteMany({ where: { id: kpiId, clientId } });
}

/** Verwerfungsregeln sind im Kundenprofil einsehbar und löschbar (BRIEFING 7.4). */
export async function deleteDismissalRule(deps: Deps, actor: NamedActor, clientId: string, ruleId: string) {
  const ctx = await loadPermissionContext(deps.db, actor.id);
  assert(profileAccess(actor, ctx, clientId) === "EDIT");
  await deps.db.dismissalRule.deleteMany({ where: { id: ruleId, clientId } });
}

// ------------------------------------------------------------- Unterlagen und KI-Vorschläge

/** Abschnitte und Felder als Beschreibung für die KI. */
export function sectionsForAi(): string {
  return PROFILE_SECTIONS.map((s) => {
    if (s.key === "sprecher") return "sprecher: Feld sprecher mit {name, function, topics}";
    const fields = sectionFields(s.key);
    return fields.length ? `${s.key}: ${fields.map((f) => `${f.key} (${f.type})`).join(", ")}` : null;
  })
    .filter(Boolean)
    .join("\n");
}

/** Kompaktes Profil als Text für KI-Aufrufe; nur, was die Aufgabe braucht (BRIEFING 8.3 Regel 4). */
export async function profileForAi(db: PrismaClient, clientId: string, keys?: string[]): Promise<string> {
  const [client, sections, speakers] = await Promise.all([
    requireClient(db, clientId),
    db.clientProfileSection.findMany({ where: { clientId, key: keys ? { in: keys } : undefined } }),
    !keys || keys.includes("sprecher") ? db.speaker.findMany({ where: { clientId } }) : Promise.resolve([]),
  ]);
  const lines = [`Kunde: ${client.name} (${client.cluster ?? ""}, ${client.industry ?? ""})`];
  for (const section of sections) {
    const content = section.content as SectionContent;
    for (const [field, value] of Object.entries(content)) {
      if (Array.isArray(value) && value.length === 0) continue;
      if (!value) continue;
      const text = Array.isArray(value)
        ? value.map((v) => (typeof v === "string" ? v : `${v.text}${v.source ? ` (Quelle: ${v.source}${v.date ? `, ${v.date}` : ""})` : ""}`)).join("; ")
        : value;
      lines.push(`${section.key}.${field}: ${text}`);
    }
  }
  if (speakers.length) lines.push(`sprecher: ${speakers.map((s) => `${s.name}, ${s.function}${s.quoteNeedsClientApproval ? " (Zitat braucht Freigabe des Kunden)" : ""}`).join("; ")}`);
  return lines.join("\n");
}

/**
 * Unterlage hochladen (BRIEFING 6.8, 7.7, 9): Ablage im Dateispeicher und zusätzlich im SharePoint
 * unter 01_Kundenprofil; die KI liest sie und legt Vorschläge an.
 */
export async function uploadProfileDocument(
  deps: Deps,
  actor: NamedActor,
  clientId: string,
  input: { sectionKey: string; file: { name: string; mimeType: string; data: Uint8Array } },
): Promise<{ fileId: string; suggestions: number; aiNotice: string | null }> {
  const client = await requireClient(deps.db, clientId);
  const ctx = await loadPermissionContext(deps.db, actor.id);
  assert(profileAccess(actor, ctx, clientId) === "EDIT");
  if (!sectionDef(input.sectionKey)) throw new DomainError(t.profile.errors.fieldInvalid);
  if (input.file.data.byteLength > 20 * 1024 * 1024) throw new DomainError(t.tasks.errors.attachmentTooLarge);

  const storageKey = `clients/${clientId}/profil/${crypto.randomUUID()}`;
  await deps.files.put(storageKey, input.file.data, input.file.mimeType);
  const stored = await deps.db.file.create({
    data: {
      storageKey,
      name: input.file.name,
      mimeType: input.file.mimeType,
      size: input.file.data.byteLength,
      clientId,
      profileSection: input.sectionKey,
      uploadedBy: actor.id,
      createdBy: actor.id,
    },
  });
  const folder = `${clientFolder(client.shortName)}/${UPLOAD_FOLDER[input.sectionKey] ?? DEFAULT_UPLOAD_FOLDER}`;
  await deps.documents.putFile(folder, input.file.name.replace(/[^\w.\-äöüÄÖÜß ]/g, "_"), input.file.data, input.file.mimeType);

  if (!client.aiAllowed) return { fileId: stored.id, suggestions: 0, aiNotice: t.ai.disabledForClient };
  try {
    const text = await extractDocumentText(input.file);
    if (!text) return { fileId: stored.id, suggestions: 0, aiNotice: t.profile.noTextExtracted };
    const result = await callAi(deps, "profile-from-documents", {
      clientIds: [clientId],
      vars: { abschnitte: sectionsForAi(), profil: await profileForAi(deps.db, clientId), unterlagen: `${input.file.name}\n${text}` },
    });
    const count = await storeAiSuggestions(deps, clientId, result.data.suggestions, { ...result, sourceFileId: stored.id, actorId: actor.id });
    return { fileId: stored.id, suggestions: count, aiNotice: null };
  } catch (error) {
    if (error instanceof AiUnavailableError || error instanceof AiOutputError || error instanceof AiNotAllowedError) {
      return { fileId: stored.id, suggestions: 0, aiNotice: error.message };
    }
    throw error;
  }
}

/**
 * Lernendes Profil (BRIEFING 7.7): ein erledigter Text wird auf neue Fakten, Zitate oder Botschaften
 * geprüft. Ohne KI oder bei Fehlern passiert nichts; der Versand bleibt davon unberührt.
 */
export async function learnFromFinalText(deps: Deps, taskId: string, actorId: string | null): Promise<number> {
  const task = await deps.db.task.findUnique({ where: { id: taskId }, include: { document: { include: { documentFormat: true } } } });
  if (!task?.document || !(await aiAllowedFor(deps.db, task.clientId))) return 0;
  const { blockTexts } = await import("@/lib/editor/content");
  const text = blockTexts(task.document.content as never).map((b) => `${b.label}: ${b.text}`).join("\n");
  try {
    const result = await callAi(deps, "profile-from-final-text", {
      clientIds: [task.clientId],
      vars: { profil: await profileForAi(deps.db, task.clientId), form: task.document.documentFormat.name, datum: deps.now().toISOString().slice(0, 10), text },
    });
    return storeAiSuggestions(deps, task.clientId, result.data.suggestions, { ...result, sourceDocumentId: task.document.id, actorId });
  } catch (error) {
    console.warn(`[profil] Lernen aus finalem Text übersprungen: ${error instanceof Error ? error.name : "unbekannt"}`);
    return 0;
  }
}

// ------------------------------------------------------------- Onboarding und Aktivierung (BRIEFING 6.8)

export type OnboardingState = { questions?: { sectionKey: string; question: string; answer?: string }[]; step?: string };

/** Was fehlt noch für den Status Aktiv? Pflichtabschnitte bestätigt und mit Inhalt (DECISIONS D-068). */
export async function missingForActivation(db: PrismaClient, clientId: string): Promise<string[]> {
  const [sections, speakers] = await Promise.all([
    db.clientProfileSection.findMany({ where: { clientId } }),
    db.speaker.count({ where: { clientId } }),
  ]);
  const byKey = new Map(sections.map((s) => [s.key, s]));
  const missing: string[] = [];
  for (const def of PROFILE_SECTIONS.filter((s) => s.required)) {
    const row = byKey.get(def.key);
    const content = (row?.content ?? {}) as SectionContent;
    const filled =
      def.key === "sprecher" ? speakers > 0 :
      def.key === "ziele_kernbotschaften" ? Array.isArray(content.kernbotschaften) && content.kernbotschaften.length > 0 :
      def.key === "themen_suchbegriffe" ? Array.isArray(content.themen) && content.themen.length > 0 :
      true;
    if (!row?.confirmedAt || !filled) missing.push(def.key);
  }
  return missing;
}

/** Fragen zu Lücken erzeugen (BRIEFING 7.7, 8.1); das Interview ist unterbrechbar. */
export async function generateOnboardingQuestions(deps: Deps, actor: NamedActor, clientId: string) {
  await requireClient(deps.db, clientId);
  const ctx = await loadPermissionContext(deps.db, actor.id);
  assert(profileAccess(actor, ctx, clientId) === "EDIT");
  const gaps = await missingForActivation(deps.db, clientId);
  const sections = await deps.db.clientProfileSection.findMany({ where: { clientId } });
  const thin = PROFILE_SECTIONS.filter((s) => !s.required && "fields" in s && !sections.some((r) => r.key === s.key && r.confirmedAt)).map((s) => s.key);
  const result = await callAi(deps, "onboarding-questions", {
    clientIds: [clientId],
    vars: { profil: await profileForAi(deps.db, clientId), luecken: [...gaps, ...thin].join(", ") },
  });
  const questions = result.data.questions.filter((q) => sectionDef(q.sectionKey));
  await saveOnboardingState(deps, clientId, { questions }, actor.id);
  return questions;
}

/** Stand des Onboardings merken, damit es sich unterbrechen und fortsetzen lässt (BRIEFING 7.7). */
export async function setOnboardingStep(deps: Deps, actor: NamedActor, clientId: string, step: string) {
  await requireClient(deps.db, clientId);
  const ctx = await loadPermissionContext(deps.db, actor.id);
  assert(profileAccess(actor, ctx, clientId) === "EDIT");
  await saveOnboardingState(deps, clientId, { step }, actor.id);
}

async function saveOnboardingState(deps: Deps, clientId: string, patch: OnboardingState, actorId: string) {
  const row = await deps.db.clientProfileSection.findUnique({ where: { clientId_key: { clientId, key: "onboarding" } } });
  const content = { ...((row?.content ?? {}) as OnboardingState), ...patch };
  await deps.db.clientProfileSection.upsert({
    where: { clientId_key: { clientId, key: "onboarding" } },
    update: { content: content as Prisma.InputJsonValue, updatedBy: actorId },
    create: { clientId, key: "onboarding", content: content as Prisma.InputJsonValue, createdBy: actorId },
  });
}

/** Antwort auf eine Onboarding-Frage wird in den Abschnitt übernommen (BRIEFING 7.7). */
export async function answerOnboardingQuestion(deps: Deps, actor: NamedActor, clientId: string, index: number, answer: string) {
  const profile = await loadProfile(deps.db, clientId);
  const question = profile.onboarding.questions?.[index];
  if (!question) throw new NotFoundError(t.errors.notFound);
  const text = answer.trim();
  if (!text) throw new DomainError(t.profile.errors.valueRequired);
  if (question.sectionKey === "sprecher") {
    await saveSpeaker(deps, actor, clientId, null, { name: text });
  } else {
    const field = sectionFields(question.sectionKey)[question.sectionKey === "ziele_kernbotschaften" ? 1 : 0];
    if (!field) throw new DomainError(t.profile.errors.fieldInvalid);
    const row = profile.sections.find((s) => s.def.key === question.sectionKey);
    const current = row?.content[field.key];
    const merged =
      field.type === "text"
        ? [typeof current === "string" ? current : "", text].filter(Boolean).join("\n")
        : field.type === "list"
          ? [...(Array.isArray(current) ? (current as string[]) : []), text].join("\n")
          : [...(Array.isArray(current) ? (current as Fact[]).map((f) => f.text) : []), text].join("\n");
    await updateSection(deps, actor, clientId, question.sectionKey, { [field.key]: merged });
  }
  const questions = [...(profile.onboarding.questions ?? [])];
  questions[index] = { ...question, answer: text };
  await saveOnboardingState(deps, clientId, { questions }, actor.id);
}

