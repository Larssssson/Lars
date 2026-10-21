import type { z } from "zod";
import {
  articleDraftSchema,
  checkSchema,
  headlinesSchema,
  journalistSuggestionsSchema,
  leadSchema,
  onboardingQuestionsSchema,
  profileSuggestionsSchema,
  quoteSchema,
  relevanceSchema,
  summarySchema,
} from "./schemas";

/**
 * Die KI-Funktionen aus BRIEFING 8.1: Prompt, Modellklasse, Temperatur (8.3 Regel 3), Schema.
 * Prüfung und Relevanz mit Temperatur 0, Formulierungsvorschläge mit 0,4.
 */
export const AI_FUNCTIONS = {
  check: { model: "QUALITY", temperature: 0, schema: checkSchema },
  headlines: { model: "QUALITY", temperature: 0.4, schema: headlinesSchema },
  quote: { model: "QUALITY", temperature: 0.4, schema: quoteSchema },
  lead: { model: "QUALITY", temperature: 0.4, schema: leadSchema },
  relevance: { model: "FAST", temperature: 0, schema: relevanceSchema },
  summary: { model: "FAST", temperature: 0.4, schema: summarySchema },
  "article-draft": { model: "QUALITY", temperature: 0.4, schema: articleDraftSchema },
  "profile-from-documents": { model: "QUALITY", temperature: 0, schema: profileSuggestionsSchema },
  "profile-from-final-text": { model: "FAST", temperature: 0, schema: profileSuggestionsSchema },
  "onboarding-questions": { model: "FAST", temperature: 0.4, schema: onboardingQuestionsSchema },
  "journalist-suggestions": { model: "FAST", temperature: 0, schema: journalistSuggestionsSchema },
} as const satisfies Record<string, { model: "QUALITY" | "FAST"; temperature: number; schema: z.ZodType }>;

export type AiFunctionKey = keyof typeof AI_FUNCTIONS;
export type AiOutput<K extends AiFunctionKey> = z.infer<(typeof AI_FUNCTIONS)[K]["schema"]>;
