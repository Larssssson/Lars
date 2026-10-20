import type { HealthStatus } from "../health";

/**
 * Low-Level-Zugang zum Sprachmodell. Nur /lib/ai (ai-service) nutzt diese Schnittstelle;
 * Prompt-Versionen, Zod-Prüfung und Kundenschalter liegen dort (BRIEFING 8.3).
 */
export type AiRequest = {
  /** Funktion aus BRIEFING 8.1, z. B. "headlines"; bestimmt im Ersatz die Beispielantwort */
  functionKey: string;
  model: string;
  temperature: number;
  system: string;
  prompt: string;
  /** nur Ersatz: andere Beispielantwort wählen, z. B. "invalid" */
  fixtureVariant?: string;
};

export type AiResponse = { text: string; model: string };

export interface AiProvider {
  readonly kind: "mock" | "anthropic";
  complete(request: AiRequest): Promise<AiResponse>;
  health(): Promise<HealthStatus>;
}
