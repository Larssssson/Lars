import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AiProvider, AiRequest, AiResponse } from "./types";

/** Ersatz: feste Beispielantworten aus fixtures/ai/<funktion>.<variante>.json. */
export class MockAiProvider implements AiProvider {
  readonly kind = "mock" as const;

  constructor(private readonly fixturesDir: string) {}

  async complete(request: AiRequest): Promise<AiResponse> {
    const variant = request.fixtureVariant ?? "valid";
    const file = path.join(this.fixturesDir, `${request.functionKey}.${variant}.json`);
    try {
      return { text: await readFile(file, "utf8"), model: `mock:${request.model}` };
    } catch {
      throw new Error(`Keine KI-Beispielantwort für "${request.functionKey}" (${variant}).`);
    }
  }

  async health() {
    return { ok: true, detail: "Ersatz mit Beispielantworten" };
  }
}
