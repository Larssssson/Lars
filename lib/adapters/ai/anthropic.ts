import { AdapterNotReadyError, requireVars } from "../errors";
import type { AiProvider, AiResponse } from "./types";

/** Echter Zugang über das Anthropic SDK. Implementierung in Phase 3/6. */
export class AnthropicAiProvider implements AiProvider {
  readonly kind = "anthropic" as const;

  constructor(config: { apiKey?: string }) {
    requireVars("Claude API", { ANTHROPIC_API_KEY: config.apiKey });
  }

  async complete(): Promise<AiResponse> {
    throw new AdapterNotReadyError("Claude API");
  }

  async health() {
    return { ok: false, detail: "noch nicht implementiert" };
  }
}
