import { t } from "@/i18n";
import type { AiProvider } from "@/lib/adapters";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { env } from "@/lib/env";
import { AiNotAllowedError, AiOutputError, AiUnavailableError } from "./errors";
import { AI_FUNCTIONS, type AiFunctionKey, type AiOutput } from "./functions";
import { loadPrompt, render } from "./prompts";
import { redactDeep } from "./sanitize";

/**
 * ai-service: der einzige Weg zur KI (BRIEFING 8). Prüft den Kundenschalter, entfernt Kontaktdaten,
 * füllt den versionierten Prompt, prüft die Antwort mit Zod und versucht es bei ungültiger Ausgabe
 * genau einmal erneut. Jede Ausgabe trägt Modell und Promptversion.
 */
export type AiDeps = { db: PrismaClient; ai: AiProvider };

export type AiResult<K extends AiFunctionKey> = { data: AiOutput<K>; model: string; promptVersion: string };

/** Modelle aus der Verwaltung überschreiben die Umgebungsvariablen (DECISIONS D-033). */
async function modelFor(db: PrismaClient, kind: "QUALITY" | "FAST"): Promise<string> {
  const setting = await db.setting.findUnique({ where: { key: "aiModels" } });
  const value = (setting?.value ?? {}) as { quality?: string; fast?: string };
  return kind === "QUALITY" ? value.quality ?? env().AI_MODEL_QUALITY : value.fast ?? env().AI_MODEL_FAST;
}

/** JSON aus der Antwort lesen, auch wenn das Modell Text drumherum schreibt. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("kein JSON");
  return JSON.parse(text.slice(start, end + 1));
}

/** Darf für diesen Kunden KI genutzt werden? (BRIEFING 7.7, 8.3 Regel 7) */
export async function assertAiAllowed(db: PrismaClient, clientIds: string[]): Promise<void> {
  if (clientIds.length === 0) return;
  const blocked = await db.client.findFirst({ where: { id: { in: clientIds }, aiAllowed: false }, select: { name: true } });
  if (blocked) throw new AiNotAllowedError(t.ai.notAllowed(blocked.name));
}

export async function aiAllowedFor(db: PrismaClient, clientId: string): Promise<boolean> {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { aiAllowed: true } });
  return client?.aiAllowed ?? false;
}

export async function callAi<K extends AiFunctionKey>(
  deps: AiDeps,
  fn: K,
  input: { clientIds: string[]; vars: Record<string, unknown>; fixtureVariant?: string },
): Promise<AiResult<K>> {
  await assertAiAllowed(deps.db, input.clientIds);
  const spec = AI_FUNCTIONS[fn];
  const prompt = await loadPrompt(fn);
  const model = await modelFor(deps.db, spec.model);
  const vars = redactDeep(input.vars);
  const request = {
    functionKey: fn,
    model,
    temperature: spec.temperature,
    system: render(prompt.system, vars),
    prompt: render(prompt.user, vars),
    fixtureVariant: input.fixtureVariant,
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    let text: string;
    try {
      text = (await deps.ai.complete(request)).text;
    } catch {
      console.error(`[ai] ${fn}: Dienst nicht erreichbar`);
      throw new AiUnavailableError(t.ai.unavailable);
    }
    try {
      const parsed = spec.schema.safeParse(extractJson(text));
      if (parsed.success) return { data: parsed.data as AiOutput<K>, model, promptVersion: `${fn}@${prompt.version}` };
    } catch {
      // ungültiges JSON: zweiter Versuch
    }
    console.warn(`[ai] ${fn}: ungültige Ausgabe, Versuch ${attempt}`);
  }
  throw new AiOutputError(t.ai.invalidOutput);
}
