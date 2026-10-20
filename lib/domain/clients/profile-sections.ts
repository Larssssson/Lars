/** Abschnitte des Kundenprofils (BRIEFING 7.7). required = Pflicht für den Status Aktiv. */
export const PROFILE_SECTIONS = [
  { key: "stammdaten", required: true },
  { key: "ziele_kernbotschaften", required: true },
  { key: "kpis", required: false },
  { key: "vereinbarte_leistungen", required: true },
  { key: "sprecher", required: true },
  { key: "themen_suchbegriffe", required: true },
  { key: "wettbewerber", required: false },
  { key: "zielmedien", required: false },
  { key: "tone_of_voice", required: false },
  { key: "styleguide", required: false },
  { key: "compliance", required: false },
  { key: "factsheet", required: false },
  { key: "qa", required: false },
  { key: "tabuthemen", required: false },
  { key: "strategie", required: false },
  { key: "dokumente", required: false },
] as const;

export type ProfileSectionKey = (typeof PROFILE_SECTIONS)[number]["key"];

/** Warnung nach 90 Tagen ohne Bestätigung, Compliance rot nach 365 Tagen (BRIEFING 7.7). */
export const PROFILE_STALE_DAYS = 90;
export const COMPLIANCE_STALE_DAYS = 365;
