import { z } from "zod";

/** Ausgaben aller KI-Funktionen aus BRIEFING 8.1, mit Zod geprüft (8.3 Regel 2). */

export const CHECK_CATEGORIES = ["COMPLIANCE", "FAKTENTREUE", "STYLEGUIDE", "TONE", "RESONANZ", "ERWEITERUNG", "DISTRIBUTION"] as const;
export type CheckCategory = (typeof CHECK_CATEGORIES)[number] | "STRUKTUR";

/** Jeder Hinweis hat eine Fundstelle oder "betrifft den ganzen Text" (8.3 Regel 6). */
export const anchorSchema = z.union([
  z.object({ blockKey: z.string().min(1), quote: z.string().min(1).max(400) }),
  z.object({ wholeText: z.literal(true) }),
]);
export type FindingAnchor = z.infer<typeof anchorSchema>;

export const checkSchema = z.object({
  scores: z.object({ conformity: z.number().int().min(0).max(100), resonance: z.number().int().min(0).max(100).nullable() }),
  findings: z.array(
    z.object({
      category: z.enum(CHECK_CATEGORIES),
      severity: z.enum(["KRITISCH", "WICHTIG", "HINWEIS"]),
      confidence: z.enum(["HOCH", "MITTEL", "NIEDRIG"]),
      anchor: anchorSchema,
      message: z.string().min(1).max(300),
      reason: z.string().min(1).max(400),
      suggestion: z.enum(["HEADLINE", "ZITAT", "LEAD"]).nullable().optional(),
    }),
  ),
});

export const headlinesSchema = z.object({ headlines: z.array(z.string().min(1).max(200)).length(3) });
export const quoteSchema = z.object({ quote: z.string().min(1).max(600), speaker: z.string().min(1).max(200) });
export const leadSchema = z.object({ lead: z.string().min(1).max(800) });

export const relevanceSchema = z.object({
  results: z.array(z.object({ articleId: z.string().min(1), clientId: z.string().min(1), score: z.number().int().min(0).max(100), reason: z.string().min(1).max(300) })),
});
export const summarySchema = z.object({ summary: z.string().min(1).max(800) });
export const articleDraftSchema = z.object({ blocks: z.record(z.string(), z.string().max(4000)) });

/** Vorschlag für einen Profilabschnitt (BRIEFING 7.7): Feld und Wert, nie direkt übernommen. */
export const profileSuggestionSchema = z.object({
  sectionKey: z.string().min(1),
  field: z.string().min(1),
  value: z.union([
    z.string().min(1).max(2000),
    z.object({ text: z.string().min(1).max(500), source: z.string().max(200).optional(), date: z.string().max(40).optional() }),
    z.object({ name: z.string().min(1).max(200), function: z.string().max(200), topics: z.array(z.string().max(100)).max(10) }),
  ]),
  note: z.string().max(300).optional(),
});
export type ProfileSuggestionOutput = z.infer<typeof profileSuggestionSchema>;
export const profileSuggestionsSchema = z.object({ suggestions: z.array(profileSuggestionSchema).max(40) });

export const onboardingQuestionsSchema = z.object({
  questions: z.array(z.object({ sectionKey: z.string().min(1), question: z.string().min(1).max(300) })).max(30),
});

export const journalistSuggestionsSchema = z.object({
  suggestions: z.array(z.object({ journalistId: z.string().min(1), reason: z.string().min(1).max(200) })).max(20),
});
