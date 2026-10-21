import Anthropic from "@anthropic-ai/sdk";
import { requireVars } from "../errors";
import type { AiProvider, AiRequest, AiResponse } from "./types";

/**
 * Modelle, die eigene Sampling-Werte ablehnen (400 bei temperature außer dem Standard).
 * Für sie entfällt die Temperatur aus BRIEFING 8.3 Regel 3 (DECISIONS D-076).
 */
const NO_SAMPLING = /^claude-(fable|mythos|opus-5|opus-4-[78]|sonnet-5|haiku-5)/;

export function acceptsTemperature(model: string): boolean {
  return !NO_SAMPLING.test(model);
}

/** Echter Zugang über das Anthropic SDK (BRIEFING 8, 10.2). Nur ai-service ruft ihn auf. */
export class AnthropicAiProvider implements AiProvider {
  readonly kind = "anthropic" as const;
  private readonly client: Anthropic;

  /** fetch nur für Tests austauschbar */
  constructor(config: { apiKey?: string; fetch?: typeof fetch }) {
    requireVars("Claude API", { ANTHROPIC_API_KEY: config.apiKey });
    this.client = new Anthropic({ apiKey: config.apiKey, maxRetries: 2, timeout: 120_000, ...(config.fetch ? { fetch: config.fetch } : {}) });
  }

  async complete(request: AiRequest): Promise<AiResponse> {
    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: 16_000,
      system: request.system,
      messages: [{ role: "user", content: request.prompt }],
      ...(acceptsTemperature(request.model) ? { temperature: request.temperature } : {}),
    });
    if (response.stop_reason === "refusal") throw new Error("Claude API: Anfrage abgelehnt");
    const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
    return { text, model: response.model };
  }

  async health() {
    try {
      await this.client.models.list({ limit: 1 });
      return { ok: true, detail: "Claude API erreichbar" };
    } catch (error) {
      return { ok: false, detail: error instanceof Anthropic.APIError ? `Claude API: Status ${error.status}` : "Claude API nicht erreichbar" };
    }
  }
}
