import type { ReportTemplate } from "@/lib/generated/prisma/enums";

/** Bausteine des Reportings (DECISIONS D-133). */
export const REPORT_BLOCKS = ["kennzahlen", "einordnung", "verlauf", "shareOfVoice", "tiers", "tonalitaet", "highlights", "topArtikel", "medienliste"] as const;
export type ReportBlock = (typeof REPORT_BLOCKS)[number];

/**
 * Drei Vorlagen: Reihenfolge aller Bausteine, Vorauswahl und Gestaltung. Gewählt werden die Bausteine
 * vor dem Erstellen; die Reihenfolge bleibt die der Vorlage.
 */
export const TEMPLATES: Record<ReportTemplate, { order: ReportBlock[]; defaults: ReportBlock[]; cover: boolean; style: "kompakt" | "bericht" | "management" }> = {
  KOMPAKT: {
    order: ["kennzahlen", "shareOfVoice", "topArtikel", "einordnung", "tiers", "tonalitaet", "verlauf", "highlights", "medienliste"],
    defaults: ["kennzahlen", "shareOfVoice", "topArtikel"],
    cover: false,
    style: "kompakt",
  },
  MONATSBERICHT: {
    order: ["einordnung", "kennzahlen", "verlauf", "shareOfVoice", "tiers", "tonalitaet", "highlights", "topArtikel", "medienliste"],
    defaults: ["einordnung", "kennzahlen", "verlauf", "shareOfVoice", "tiers", "tonalitaet", "highlights", "topArtikel", "medienliste"],
    cover: true,
    style: "bericht",
  },
  MANAGEMENT: {
    order: ["kennzahlen", "einordnung", "highlights", "shareOfVoice", "verlauf", "tiers", "tonalitaet", "topArtikel", "medienliste"],
    defaults: ["kennzahlen", "einordnung", "highlights", "shareOfVoice", "verlauf"],
    cover: false,
    style: "management",
  },
};

export function orderedBlocks(template: ReportTemplate, selected: string[]): ReportBlock[] {
  return TEMPLATES[template].order.filter((b) => selected.includes(b));
}
