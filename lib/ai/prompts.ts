import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Versionierte Prompts aus /prompts, eine Datei pro Funktion (BRIEFING 8.3 Regel 1).
 * Aufbau: Kopf mit "version", dann "# System" und "# Nutzer"; Platzhalter als {{name}}.
 */
export type Prompt = { key: string; version: string; system: string; user: string };

const cache = new Map<string, Prompt>();
const PROMPT_DIR = path.resolve("prompts");

export function parsePrompt(key: string, raw: string): Prompt {
  const head = /^---\n([\s\S]*?)\n---\n/.exec(raw);
  const version = head ? /version:\s*(\S+)/.exec(head[1]!)?.[1] : undefined;
  const body = head ? raw.slice(head[0].length) : raw;
  const system = /# System\n([\s\S]*?)(?=\n# Nutzer\n)/.exec(body)?.[1]?.trim();
  const user = /# Nutzer\n([\s\S]*)$/.exec(body)?.[1]?.trim();
  if (!version || !system || !user) throw new Error(`Prompt ${key} ist unvollständig.`);
  return { key, version, system, user };
}

export async function loadPrompt(key: string): Promise<Prompt> {
  const cached = cache.get(key);
  if (cached) return cached;
  const prompt = parsePrompt(key, await readFile(path.join(PROMPT_DIR, `${key}.md`), "utf8"));
  cache.set(key, prompt);
  return prompt;
}

/** Platzhalter füllen; Objekte und Listen als JSON. */
export function render(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = vars[name];
    if (value === undefined || value === null) return "";
    return typeof value === "string" ? value : JSON.stringify(value, null, 1);
  });
}
