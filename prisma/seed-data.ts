/**
 * Grunddaten und Beispieldaten nach BRIEFING 3.4, 7.3, 7.8, 9 und 13.
 * Alle Inhalte außer der Konfiguration sind erfunden.
 * Mailadressen sind Platzhalter (DECISIONS D-037).
 */

export const seedUsers = [
  { key: "lars", name: "Lars Scholtyssyk", email: "lars@example.com", role: "CVD", isAdmin: true },
  { key: "lukas", name: "Lukas", email: "lukas@example.com", role: "CVD", isAdmin: true },
  { key: "laura", name: "Laura", email: "laura@example.com", role: "REDAKTEUR", isAdmin: false },
  { key: "robin", name: "Robin", email: "robin@example.com", role: "REDAKTEUR", isAdmin: false },
  { key: "mika", name: "Mika", email: "mika@example.com", role: "REDAKTEUR", isAdmin: false },
  { key: "juliana", name: "Juliana", email: "juliana@example.com", role: "REDAKTEUR", isAdmin: false },
  { key: "hannah", name: "Hannah", email: "hannah@example.com", role: "REDAKTEUR", isAdmin: false },
  { key: "valentin", name: "Valentin Abel", email: "valentin@example.com", role: "REDAKTEUR", isAdmin: false },
] as const;

export type SeedUserKey = (typeof seedUsers)[number]["key"];

/** BRIEFING 13.1; Kunden-Leads nach DECISIONS D-002. */
export const seedClients: {
  name: string;
  shortName: string;
  industry: string;
  cluster: string;
  status: "AKTIV" | "ONBOARDING";
  lead: SeedUserKey;
  leadCanApprove: boolean;
  team: SeedUserKey[];
}[] = [
  { name: "Covenant", shortName: "Covenant", industry: "[Beispiel] Rüstung", cluster: "Defence", status: "AKTIV", lead: "lukas", leadCanApprove: false, team: ["laura", "robin"] },
  { name: "Ground A", shortName: "Ground A", industry: "[Beispiel] Lasertechnik", cluster: "Technologie", status: "AKTIV", lead: "lars", leadCanApprove: false, team: ["mika", "juliana"] },
  { name: "Rafael", shortName: "Rafael", industry: "[Beispiel] Luftverteidigung", cluster: "Defence", status: "AKTIV", lead: "lars", leadCanApprove: false, team: ["robin", "hannah"] },
  // Valentin Abel: Freigaberecht für SAFENET eingeschaltet (BRIEFING 3.4)
  { name: "SAFENET", shortName: "SAFENET", industry: "[Beispiel] IT-Sicherheit", cluster: "Technologie", status: "ONBOARDING", lead: "valentin", leadCanApprove: true, team: ["juliana"] },
];

/** Diensttypen zum Start (BRIEFING 7.8, Wochenenddienst nach DECISIONS D-025). Konfiguration, keine Beispieldaten. */
export const seedShiftTypes = [
  { key: "CVD_VOM_DIENST", name: "CVD vom Dienst", defaultStart: "08:00", defaultEnd: "18:00", weekdays: [1, 2, 3, 4, 5], createsTask: false, sortOrder: 1 },
  { key: "PRESSESPIEGEL", name: "Pressespiegel-Dienst", defaultStart: "07:00", defaultEnd: "10:00", weekdays: [1, 2, 3, 4, 5], createsTask: true, sortOrder: 2 },
  { key: "WOCHENENDE", name: "Wochenenddienst", defaultStart: "09:00", defaultEnd: "17:00", weekdays: [6, 7], createsTask: false, sortOrder: 3 },
];

type Block = { key: string; label: string; required: boolean };
const b = (key: string, label: string, required = false): Block => ({ key, label, required });

/** Darstellungsformen mit Bausteinen und Strukturregeln (BRIEFING 7.3), Ordner nach BRIEFING 9. Konfiguration. */
export const seedFormats: {
  key: string;
  name: string;
  blocks: Block[];
  rules: Record<string, number | boolean>;
  rulesText: string | null;
  sharePointFolder: string;
}[] = [
  {
    key: "PRESSEMITTEILUNG",
    name: "Pressemitteilung",
    blocks: [
      b("dachzeile", "Dachzeile"), b("headline", "Headline", true), b("subheadline", "Subheadline"),
      b("ortsmarke", "Ortsmarke und Datum", true), b("lead", "Lead", true), b("haupttext", "Haupttext", true),
      b("zitat", "Zitat mit Sprecher", true), b("boilerplate", "Boilerplate", true),
      b("pressekontakt", "Pressekontakt", true), b("sperrfrist", "Sperrfrist"),
    ],
    rules: { minChars: 2000, maxChars: 4500, firstQuoteWithinChars: 1500, requiresNumber: true, leadAnswersWQuestions: true },
    rulesText: "Lead beantwortet Wer, Was, Wann, Wo; mindestens eine Zahl; erstes Zitat innerhalb der ersten 1.500 Zeichen; Länge 2.000 bis 4.500 Zeichen",
    sharePointFolder: "02_Pressemitteilungen",
  },
  {
    key: "STATEMENT",
    name: "Statement",
    blocks: [b("sprecher", "Sprecher", true), b("anlass", "Anlass", true), b("text", "Text", true)],
    rules: { maxChars: 1200, speakerInSpeakerList: true },
    rulesText: "höchstens 1.200 Zeichen; Sprecher steht in der Sprecherliste",
    sharePointFolder: "03_Statements",
  },
  {
    key: "QA",
    name: "Q&A",
    blocks: [b("stand", "Stand (Datum)", true), b("verwendung", "Verwendung (intern oder extern)", true), b("fragen", "Fragen und Antworten", true)],
    rules: { everyQuestionAnswered: true },
    rulesText: "jede Frage hat eine Antwort",
    sharePointFolder: "01_Kundenprofil/QA",
  },
  {
    key: "MEDIEN_PITCH",
    name: "Medien-Pitch",
    blocks: [b("betreff", "Betreff", true), b("aufhaenger", "Aufhänger", true), b("angebot", "Angebot (Interview, Exklusivinfo, Hintergrund)", true), b("ansprechpartner", "Ansprechpartner", true)],
    rules: { maxChars: 1500 },
    rulesText: "höchstens 1.500 Zeichen",
    sharePointFolder: "04_Medienansprache",
  },
  {
    key: "BRIEFING",
    name: "Briefing",
    blocks: [b("anlass", "Anlass", true), b("hintergrund", "Hintergrund", true), b("teilnehmer", "Teilnehmer"), b("kernbotschaften", "Kernbotschaften", true), b("fragen", "Fragen")],
    rules: {},
    rulesText: null,
    sharePointFolder: "08_Briefings_und_Konzepte",
  },
  {
    key: "KONZEPT",
    name: "Konzept",
    blocks: [b("ziel", "Ziel", true), b("zielgruppe", "Zielgruppe", true), b("massnahmen", "Maßnahmen", true), b("zeitplan", "Zeitplan"), b("verantwortliche", "Verantwortliche")],
    rules: {},
    rulesText: null,
    sharePointFolder: "08_Briefings_und_Konzepte",
  },
  {
    key: "EINLADUNG",
    name: "Einladung",
    blocks: [b("anlass", "Anlass", true), b("datum_ort", "Datum, Uhrzeit, Ort", true), b("programm", "Programm", true), b("anmeldung", "Anmeldung", true)],
    rules: {},
    rulesText: null,
    sharePointFolder: "04_Medienansprache", // DECISIONS D-035
  },
  {
    key: "AGENDA",
    name: "Agenda",
    blocks: [b("titel", "Titel", true), b("programmpunkte", "Programmpunkte mit Uhrzeit", true)],
    rules: {},
    rulesText: null,
    sharePointFolder: "08_Briefings_und_Konzepte",
  },
  {
    key: "LINKEDIN_POST",
    name: "LinkedIn-Post",
    blocks: [b("text", "Text", true), b("hashtags", "Hashtags"), b("link", "Link")],
    rules: { maxChars: 3000 },
    rulesText: "höchstens 3.000 Zeichen",
    sharePointFolder: "05_Social_Media",
  },
  {
    key: "LINKEDIN_KOMMENTAR",
    name: "LinkedIn-Kommentar",
    blocks: [b("text", "Text", true), b("bezugsartikel", "Bezugsartikel", true)],
    rules: { maxChars: 1250 },
    rulesText: "höchstens 1.250 Zeichen",
    sharePointFolder: "05_Social_Media",
  },
  {
    key: "EINSCHAETZUNG",
    name: "Einschätzung",
    blocks: [b("bezugsartikel", "Bezugsartikel", true), b("kurzfassung", "Kurzfassung", true), b("bedeutung", "Bedeutung für den Kunden", true), b("empfehlung", "Empfehlung")],
    rules: {},
    rulesText: null,
    sharePointFolder: "06_Pressespiegel_und_Einschaetzungen",
  },
  {
    key: "PRESSESPIEGEL",
    name: "Pressespiegel",
    blocks: [b("datum", "Datum", true), b("artikel", "Artikel (je Titel, Medium, Datum, Link, Kurzfassung, Einschätzung)", true)],
    rules: { summariesInOwnWords: true },
    rulesText: "Kurzfassungen in eigenen Worten",
    sharePointFolder: "06_Pressespiegel_und_Einschaetzungen",
  },
  {
    key: "LISTE",
    name: "Liste",
    blocks: [b("titel", "Titel", true), b("eintraege", "Einträge", true)],
    rules: {},
    rulesText: null,
    sharePointFolder: "08_Briefings_und_Konzepte",
  },
];
