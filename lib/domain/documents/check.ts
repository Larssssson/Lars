import { z } from "zod";
import { t } from "@/i18n";
import { AiNotAllowedError, AiOutputError, AiUnavailableError } from "@/lib/ai/errors";
import type { CheckCategory } from "@/lib/ai/schemas";
import { callAi } from "@/lib/ai/service";
import { profileForAi } from "@/lib/domain/clients/profile";
import { COMPLIANCE_STALE_DAYS, PROFILE_STALE_DAYS, type SectionContent } from "@/lib/domain/clients/profile-sections";
import type { Deps } from "@/lib/domain/deps";
import { NotFoundError } from "@/lib/domain/errors";
import { assert, type NamedActor } from "@/lib/domain/permissions";
import { blockTexts, type BlockText, type JSONNode } from "@/lib/editor/content";
import type { CheckMode, Prisma, PrismaClient, Strictness } from "@/lib/generated/prisma/client";
import { formatDate } from "@/lib/time";
import { createVersion, loadDocument } from "./service";
import { structureFindings, type Anchor, type FormatRules, type StructureFinding } from "./structure-check";

/** Prüfschritte je Modus (BRIEFING 7.4); Struktur läuft immer regelbasiert. */
export const MODE_STEPS: Record<CheckMode, CheckCategory[]> = {
  SCHNELL: ["STRUKTUR", "COMPLIANCE", "FAKTENTREUE"],
  VOLL: ["STRUKTUR", "COMPLIANCE", "FAKTENTREUE", "STYLEGUIDE", "TONE", "RESONANZ", "ERWEITERUNG", "DISTRIBUTION"],
};

/** Profilabschnitte, die die KI je Modus bekommt (nur, was sie braucht, BRIEFING 8.3 Regel 4). */
const MODE_SECTIONS: Record<CheckMode, string[]> = {
  SCHNELL: ["compliance", "factsheet", "ziele_kernbotschaften", "sprecher", "tabuthemen"],
  VOLL: ["compliance", "factsheet", "ziele_kernbotschaften", "sprecher", "tabuthemen", "styleguide", "tone_of_voice", "zielmedien", "themen_suchbegriffe", "wettbewerber"],
};

/** Abzüge der Strukturhinweise vom Konformitätswert (DECISIONS D-071). */
const DEDUCTION = { KRITISCH: 25, WICHTIG: 10, HINWEIS: 3 } as const;

const DAY = 86_400_000;
const uuid = z.uuid();

export type CheckScores = { conformity: number; resonance: number | null; warnings: string[]; aiNotice: string | null };
type RawFinding = Omit<StructureFinding, "category"> & { category: CheckCategory; suggestion?: "HEADLINE" | "ZITAT" | "LEAD" | null };

/** Gleichartige Hinweise für Verwerfungsregeln: Kategorie plus normalisierte Meldung (DECISIONS D-072). */
export function dismissalPattern(message: string): string {
  return message
    .toLowerCase()
    .replace(/\d+([.,]\d+)*/g, "#")
    .replace(/[^\p{L}#\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Fundstelle prüfen (BRIEFING 8.3 Regel 6): das Zitat muss im genannten Baustein stehen; sonst wird
 * es in den anderen Bausteinen gesucht. Hinweise ohne auffindbare Fundstelle entfallen (DECISIONS D-073).
 */
export function resolveAnchor(anchor: Anchor, blocks: BlockText[]): Anchor | null {
  if ("wholeText" in anchor) return anchor;
  if (!anchor.quote) return blocks.some((b) => b.key === anchor.blockKey) ? anchor : null;
  const quote = squash(anchor.quote);
  const own = blocks.find((b) => b.key === anchor.blockKey);
  if (own && squash(own.text).includes(quote)) return { blockKey: own.key, quote };
  const other = blocks.find((b) => squash(b.text).includes(quote));
  return other ? { blockKey: other.key, quote } : null;
}

/** Hinweise zum Profil oben im Ergebnis (BRIEFING 7.4). */
export async function profileWarnings(db: PrismaClient, clientId: string, mode: CheckMode, now: Date): Promise<string[]> {
  const sections = await db.clientProfileSection.findMany({ where: { clientId, key: { in: MODE_SECTIONS[mode] } } });
  const byKey = new Map(sections.map((s) => [s.key, s]));
  const warnings: string[] = [];
  const filled = (key: string, field: string) => {
    const value = ((byKey.get(key)?.content ?? {}) as SectionContent)[field];
    return Array.isArray(value) ? value.length > 0 : Boolean(value && String(value).trim());
  };
  const compliance = byKey.get("compliance");
  if (!filled("compliance", "regeln")) warnings.push(t.checks.warnings.sectionMissing(t.profile.sections.compliance ?? "Compliance"));
  else if (compliance?.confirmedAt && now.getTime() - compliance.confirmedAt.getTime() > COMPLIANCE_STALE_DAYS * DAY) {
    warnings.push(t.checks.warnings.complianceStale(Math.floor((now.getTime() - compliance.confirmedAt.getTime()) / (30.44 * DAY))));
  }
  if (!filled("factsheet", "fakten")) warnings.push(t.checks.warnings.sectionMissing(t.profile.sections.factsheet ?? "Factsheet"));
  for (const section of sections) {
    if (section.key === "compliance" || !section.confirmedAt) continue;
    const days = Math.floor((now.getTime() - section.confirmedAt.getTime()) / DAY);
    if (days > PROFILE_STALE_DAYS) warnings.push(t.checks.warnings.profileStale(t.profile.sections[section.key] ?? section.key, days));
  }
  return warnings;
}

/** Frühere finale Texte als Grundlage der Faktentreue: Headline und Lead genügen. */
async function earlierFinalTexts(db: PrismaClient, clientId: string, excludeTaskId: string): Promise<string> {
  const tasks = await db.task.findMany({
    where: { clientId, type: "DOKUMENT", status: { in: ["ERLEDIGT", "ARCHIVIERT"] }, id: { not: excludeTaskId } },
    include: { document: { select: { content: true } } },
    orderBy: { completedAt: "desc" },
    take: 3,
  });
  return tasks
    .map((task) => {
      const blocks = task.document ? blockTexts(task.document.content as JSONNode) : [];
      const pick = blocks.filter((b) => ["headline", "lead", "text"].includes(b.key)).map((b) => b.text).join(" ");
      return `- ${task.title}: ${pick.slice(0, 600)}`;
    })
    .join("\n");
}

/**
 * Prüfung starten (BRIEFING 7.4): Struktur regelbasiert, die übrigen Schritte mit KI, sofern der Kunde
 * KI erlaubt. Ohne KI oder bei Ausfall bleibt die Strukturprüfung mit Hinweis (8.3 Regel 9).
 */
export async function runCheck(deps: Deps, actor: NamedActor, taskId: string, mode: CheckMode) {
  assert(actor.active);
  if (!uuid.safeParse(taskId).success) throw new NotFoundError(t.errors.notFound);
  const { task, document } = await loadDocument(deps.db, taskId);
  const now = deps.now();
  const content = document.content as JSONNode;
  const blocks = blockTexts(content);
  const strictness: Strictness = task.client.checkStrictness;
  const speakers = await deps.db.speaker.findMany({ where: { clientId: task.clientId }, select: { name: true } });
  const rules = await deps.db.dismissalRule.findMany({ where: { clientId: task.clientId } });
  const suppressed = (f: { category: string; message: string }) =>
    rules.some((r) => r.category === f.category && r.pattern === dismissalPattern(f.message));

  const findings: RawFinding[] = structureFindings({
    blocks,
    rules: document.documentFormat.rules as FormatRules,
    speakers: speakers.map((s) => s.name),
    strictness,
  });

  let ai: { conformity: number; resonance: number | null; model: string; promptVersion: string } | null = null;
  let aiNotice: string | null = null;
  if (!task.client.aiAllowed) {
    aiNotice = t.checks.aiOff;
  } else {
    try {
      const steps = MODE_STEPS[mode].filter((s) => s !== "STRUKTUR");
      const profile = await profileForAi(deps.db, task.clientId, MODE_SECTIONS[mode]);
      const earlier = await earlierFinalTexts(deps.db, task.clientId, task.id);
      const result = await callAi(deps, "check", {
        clientIds: [task.clientId],
        vars: {
          modus: mode === "VOLL" ? "Vollanalyse" : "Schnellprüfung",
          schritte: steps.join(", "),
          strenge: strictness,
          form: document.documentFormat.name,
          regeln: document.documentFormat.rulesText ?? "keine",
          heute: now.toISOString().slice(0, 10),
          profil: earlier ? `${profile}\nFrühere finale Texte:\n${earlier}` : profile,
          verwerfungen: rules.length ? rules.map((r) => `${r.category}: ${r.pattern}`).join("\n") : "keine",
          text: blocks.map((b) => `[${b.key}] ${b.label}:\n${b.text}`).join("\n\n"),
        },
      });
      ai = { conformity: result.data.scores.conformity, resonance: result.data.scores.resonance, model: result.model, promptVersion: result.promptVersion };
      for (const f of result.data.findings) {
        if (!steps.includes(f.category)) continue;
        const anchor = resolveAnchor(f.anchor, blocks);
        if (!anchor) continue;
        findings.push({ ...f, anchor });
      }
    } catch (error) {
      if (!(error instanceof AiUnavailableError || error instanceof AiOutputError || error instanceof AiNotAllowedError)) throw error;
      aiNotice = t.checks.aiFailed(error.message);
    }
  }

  const kept = findings.filter((f) => !suppressed(f));
  const deduction = kept.filter((f) => f.category === "STRUKTUR").reduce((sum, f) => sum + DEDUCTION[f.severity], 0);
  const scores: CheckScores = {
    conformity: Math.max(0, Math.min(100, (ai?.conformity ?? 100) - deduction)),
    resonance: mode === "VOLL" ? (ai?.resonance ?? null) : null,
    warnings: await profileWarnings(deps.db, task.clientId, mode, now),
    aiNotice,
  };

  return deps.db.$transaction(async (tx) => {
    // geprüft wird eine feste Fassung: die letzte Version, wenn sie dem Text entspricht, sonst eine neue
    const last = await tx.documentVersion.findFirst({ where: { documentId: document.id }, orderBy: { number: "desc" } });
    const version =
      last && JSON.stringify(last.content) === JSON.stringify(document.content)
        ? last
        : await createVersion(tx, { documentId: document.id, content: document.content as Prisma.InputJsonValue, reason: "PRUEFUNG", status: null, actorId: actor.id });
    const run = await tx.checkRun.create({
      data: {
        documentId: document.id,
        versionId: version.id,
        mode,
        strictness,
        scores: scores as Prisma.InputJsonValue,
        model: ai?.model ?? null,
        promptVersion: ai?.promptVersion ?? null,
        createdBy: actor.id,
      },
    });
    if (kept.length) {
      await tx.finding.createMany({
        data: kept.map((f) => ({
          checkRunId: run.id,
          category: f.category,
          severity: f.severity,
          confidence: f.confidence,
          anchor: f.anchor as Prisma.InputJsonValue,
          message: f.message,
          reason: f.reason,
          suggestion: f.suggestion ?? null,
          createdBy: actor.id,
        })),
      });
    }
    return run;
  });
}

/** Letzte Prüfung eines Dokuments mit Hinweisen. */
export async function latestCheck(db: PrismaClient, documentId: string) {
  const run = await db.checkRun.findFirst({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    include: { findings: { orderBy: { createdAt: "asc" } }, version: { select: { content: true, number: true } } },
  });
  if (!run) return null;
  const creator = run.createdBy ? await db.user.findUnique({ where: { id: run.createdBy }, select: { name: true } }) : null;
  return { ...run, scores: run.scores as CheckScores, createdByName: creator?.name ?? null };
}

/** Offene Hinweise der letzten Prüfung (Anzeige im Freigabebereich). */
export async function openFindingCount(db: PrismaClient, documentId: string): Promise<number> {
  const run = await db.checkRun.findFirst({ where: { documentId }, orderBy: { createdAt: "desc" }, select: { id: true } });
  return run ? db.finding.count({ where: { checkRunId: run.id, status: "OFFEN" } }) : 0;
}

async function loadFinding(db: PrismaClient, findingId: string) {
  if (!uuid.safeParse(findingId).success) throw new NotFoundError(t.checks.errors.notFound);
  const finding = await db.finding.findUnique({ where: { id: findingId }, include: { checkRun: { include: { document: { include: { task: true } } } } } });
  if (!finding) throw new NotFoundError(t.checks.errors.notFound);
  return finding;
}

/** "Erledigt": der Nutzer hat selbst geändert (BRIEFING 7.4). */
export async function markFindingDone(deps: Deps, actor: NamedActor, findingId: string) {
  assert(actor.active);
  const finding = await loadFinding(deps.db, findingId);
  await deps.db.finding.update({ where: { id: finding.id }, data: { status: "ERLEDIGT", updatedBy: actor.id } });
}

/**
 * "Verwerfen" mit optionalem Grund; mit "Für diesen Kunden nicht mehr anzeigen" entsteht eine
 * Verwerfungsregel, die gleichartige Hinweise künftig unterdrückt (BRIEFING 7.4).
 */
export async function dismissFinding(deps: Deps, actor: NamedActor, findingId: string, input: { reason?: string | null; createRule?: boolean }) {
  assert(actor.active);
  const finding = await loadFinding(deps.db, findingId);
  const clientId = finding.checkRun.document.task.clientId;
  await deps.db.$transaction(async (tx) => {
    await tx.finding.update({
      where: { id: finding.id },
      data: { status: "VERWORFEN", dismissReason: input.reason?.trim().slice(0, 500) || null, updatedBy: actor.id },
    });
    if (input.createRule) {
      const pattern = dismissalPattern(finding.message);
      const exists = await tx.dismissalRule.findFirst({ where: { clientId, category: finding.category, pattern } });
      if (!exists) await tx.dismissalRule.create({ data: { clientId, category: finding.category, pattern, createdBy: actor.id, updatedBy: actor.id } });
    }
  });
}

export function checkLabel(run: { createdAt: Date; mode: CheckMode }) {
  return t.checks.lastRun(formatDate(run.createdAt), run.mode === "VOLL" ? t.checks.full : t.checks.quick);
}
