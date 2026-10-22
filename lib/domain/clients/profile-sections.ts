/**
 * Abschnitte des Kundenprofils (BRIEFING 7.7). required = Pflicht für den Status Aktiv.
 * Felder: text (Freitext), list (eine Angabe pro Zeile), facts (Fakt mit Quelle und Datum).
 * Sonderabschnitte werden aus eigenen Tabellen gefüllt (Stammdaten, KPIs, Leistungen, Sprecher, Dokumente).
 */
export type FieldType = "text" | "list" | "facts";
export type SectionField = { key: string; type: FieldType; /** Bearbeitungsrecht als Teil für canEditProfilePart */ part?: string };

export const PROFILE_SECTIONS = [
  { key: "stammdaten", required: true, special: "client" },
  { key: "ziele_kernbotschaften", required: true, fields: [{ key: "kommunikationsziele", type: "text", part: "kommunikationsziele" }, { key: "kernbotschaften", type: "list" }] },
  { key: "kpis", required: false, special: "kpis" },
  { key: "vereinbarte_leistungen", required: true, special: "services" },
  { key: "sprecher", required: true, special: "speakers" },
  { key: "themen_suchbegriffe", required: true, fields: [{ key: "themen", type: "list" }, { key: "technologien", type: "list" }, { key: "suchbegriffe", type: "list" }, { key: "regulierung", type: "list" }] },
  { key: "wettbewerber", required: false, fields: [{ key: "wettbewerber", type: "list" }] },
  { key: "zielmedien", required: false, fields: [{ key: "medien", type: "list" }] },
  { key: "tone_of_voice", required: false, fields: [{ key: "beschreibung", type: "text" }, { key: "referenztexte", type: "text" }] },
  { key: "styleguide", required: false, fields: [{ key: "firmenname", type: "text" }, { key: "produktnamen", type: "list" }, { key: "schreibregeln", type: "list" }] },
  { key: "compliance", required: false, fields: [{ key: "regeln", type: "list" }, { key: "stand", type: "text" }, { key: "quelle", type: "text" }] },
  { key: "factsheet", required: false, fields: [{ key: "fakten", type: "facts" }, { key: "boilerplate", type: "text" }] },
  { key: "qa", required: false, fields: [{ key: "inhalt", type: "text" }, { key: "stand", type: "text" }] },
  { key: "tabuthemen", required: false, fields: [{ key: "themen", type: "list" }] },
  { key: "strategie", required: false, fields: [{ key: "notiz", type: "text" }] },
  { key: "dokumente", required: false, special: "documents" },
] as const satisfies readonly { key: string; required: boolean; special?: string; fields?: readonly SectionField[] }[];

export type ProfileSectionKey = (typeof PROFILE_SECTIONS)[number]["key"];
export type ProfileSectionDef = (typeof PROFILE_SECTIONS)[number];

export function sectionDef(key: string) {
  return PROFILE_SECTIONS.find((s) => s.key === key);
}

export function sectionFields(key: string): readonly SectionField[] {
  const def = sectionDef(key);
  return def && "fields" in def ? def.fields : [];
}

/** Warnung nach 90 Tagen ohne Bestätigung, Compliance rot nach 365 Tagen (BRIEFING 7.7). */
export const PROFILE_STALE_DAYS = 90;
export const COMPLIANCE_STALE_DAYS = 365;

/** Unterordner im SharePoint für hochgeladene Unterlagen (BRIEFING 9). */
export const UPLOAD_FOLDER: Record<string, string> = {
  strategie: "01_Kundenprofil/Strategie_und_Ansatz",
  styleguide: "01_Kundenprofil/Styleguide_und_Compliance",
  compliance: "01_Kundenprofil/Styleguide_und_Compliance",
  factsheet: "01_Kundenprofil/Factsheets",
  qa: "01_Kundenprofil/QA",
};
export const DEFAULT_UPLOAD_FOLDER = "01_Kundenprofil";

/** Inhalt eines Abschnitts: Felder nach Typ. */
export type Fact = { text: string; source?: string; date?: string };
export type SectionContent = Record<string, string | string[] | Fact[]>;
