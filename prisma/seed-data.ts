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

/** Vereinbarte Leistungen (BRIEFING 13.1), Zeiträume in Berliner Ortszeit. */
export const seedServices: {
  client: string;
  key: string;
  title: string;
  category: "ROUNDTABLE" | "PRESSEMITTEILUNG" | "HINTERGRUNDGESPRAECH" | "LINKEDIN" | "MEDIEN_PITCH";
  targetCount: number;
  from: string;
  to: string;
}[] = [
  { client: "Covenant", key: "cov_roundtable", title: "Journalisten-Roundtable", category: "ROUNDTABLE", targetCount: 1, from: "2026-07-01", to: "2026-12-31" },
  { client: "Covenant", key: "cov_pm", title: "Pressemitteilungen", category: "PRESSEMITTEILUNG", targetCount: 6, from: "2026-07-01", to: "2026-12-31" },
  { client: "Ground A", key: "ga_hintergrund", title: "Hintergrundgespräche", category: "HINTERGRUNDGESPRAECH", targetCount: 2, from: "2026-10-01", to: "2026-12-31" },
  { client: "Ground A", key: "ga_linkedin", title: "LinkedIn-Beiträge", category: "LINKEDIN", targetCount: 8, from: "2026-10-01", to: "2026-12-31" },
  { client: "Rafael", key: "raf_pitches", title: "Medien-Pitches", category: "MEDIEN_PITCH", targetCount: 3, from: "2026-10-01", to: "2026-12-31" },
];

/**
 * Bestätigungsdaten der Profilabschnitte (BRIEFING 13.1): Ground A Compliance 400 Tage alt,
 * Rafael insgesamt 95 Tage nicht bestätigt. Die Inhalte entstehen in Phase 3.
 */
export const seedProfileAges: Record<string, { default: number; overrides?: Record<string, number> }> = {
  Covenant: { default: 10 },
  "Ground A": { default: 10, overrides: { compliance: 400 } },
  Rafael: { default: 95 },
};
export const seededProfileSections = [
  "stammdaten", "ziele_kernbotschaften", "vereinbarte_leistungen", "sprecher", "themen_suchbegriffe", "compliance", "factsheet",
  "styleguide", "tone_of_voice", "zielmedien",
];

/** Erfundene Factsheet-Zahl für Covenant; die PM Standortentscheidung widerspricht ihr absichtlich (BRIEFING 13.5). */
export const covenantFacts = { jobs: 450, contradictingJobs: 600 };

type SeedFact = { text: string; source?: string; date?: string };
export type SeedProfile = {
  sections: Record<string, Record<string, string | string[] | SeedFact[]>>;
  speakers: { name: string; function: string; topics: string[]; quoteNeedsClientApproval: boolean }[];
};

/**
 * Profilinhalte (BRIEFING 13.1): kurze, offensichtlich erfundene Platzhalter mit "[Beispiel]".
 * Die Covenant-Angaben passen zu den KI-Beispielantworten in fixtures/ai/check.valid.json.
 */
export const seedProfiles: Record<string, SeedProfile> = {
  Covenant: {
    sections: {
      ziele_kernbotschaften: {
        kommunikationsziele: "[Beispiel] Covenant als verlässlichen Arbeitgeber und Partner in Sachsen bekannt machen.",
        kernbotschaften: [
          "[Beispiel] Covenant schafft in Sachsen dauerhafte Industriearbeitsplätze.",
          "[Beispiel] Der Standort stärkt die europäische Verteidigungsfähigkeit.",
          "[Beispiel] Covenant arbeitet eng mit Zulieferern aus der Region zusammen.",
        ],
      },
      themen_suchbegriffe: {
        themen: ["[Beispiel] Standort", "[Beispiel] Arbeitsplätze", "[Beispiel] Zusammenarbeit mit der Bundeswehr"],
        technologien: ["[Beispiel] Munitionsfertigung"],
        suchbegriffe: ["Covenant", "Covenant Deutschland", "Standort Leipzig"],
        regulierung: ["[Beispiel] Kriegswaffenkontrollgesetz"],
      },
      compliance: {
        regeln: [
          "[Beispiel] Aussagen zu öffentlichen Auftraggebern, insbesondere der Bundeswehr, vorab vom Kunden freigeben lassen.",
          "[Beispiel] Keine Angaben zu Stückzahlen oder Lieferterminen.",
        ],
        stand: "[Beispiel] 01.09.2026",
        quelle: "[Beispiel] Compliance-Richtlinie Covenant Deutschland",
      },
      factsheet: {
        fakten: [
          { text: `[Beispiel] ${covenantFacts.jobs} Arbeitsplätze am Standort Leipzig`, source: "[Beispiel] Factsheet Covenant", date: "2026-09-01" },
          { text: "[Beispiel] Investition von 120 Mio. Euro", source: "[Beispiel] Factsheet Covenant", date: "2026-09-01" },
          { text: "[Beispiel] Produktionsbeginn 2028", source: "[Beispiel] Factsheet Covenant", date: "2026-09-01" },
          { text: "[Beispiel] Grundstück von 35 Hektar", source: "[Beispiel] Factsheet Covenant", date: "2026-09-01" },
        ],
        boilerplate: "[Beispiel] Covenant Deutschland GmbH ist die deutsche Tochter eines US-amerikanischen Unternehmens der Verteidigungsindustrie. Am Standort Leipzig entsteht eine Fertigung für Komponenten.",
      },
      styleguide: {
        firmenname: "[Beispiel] Erstnennung „Covenant Deutschland GmbH“, danach „Covenant“",
        produktnamen: [],
        schreibregeln: ["[Beispiel] Zahlen bis zwölf ausschreiben."],
      },
      tone_of_voice: { beschreibung: "[Beispiel] Sachlich, konkret, ohne Superlative.", referenztexte: "" },
      zielmedien: { medien: ["Sachsen Rundschau (Lokales)", "Wehrtechnik Aktuell (Redaktion)", "Tagesblatt Nord (Wirtschaft)"] },
    },
    speakers: [{ name: "[Beispiel] Dr. Anna Weber", function: "Geschäftsführerin Deutschland", topics: ["Standort", "Arbeitsplätze"], quoteNeedsClientApproval: true }],
  },
  "Ground A": {
    sections: {
      ziele_kernbotschaften: {
        kommunikationsziele: "[Beispiel] Ground A als führenden Anbieter von Lasertechnik positionieren.",
        kernbotschaften: [
          "[Beispiel] Ground A entwickelt Lasertechnik in Deutschland.",
          "[Beispiel] Forschung und Fertigung sitzen an einem Ort.",
          "[Beispiel] Ground A bildet Fachkräfte selbst aus.",
        ],
      },
      themen_suchbegriffe: {
        themen: ["[Beispiel] Lasertechnik", "[Beispiel] Forschungsförderung"],
        technologien: ["[Beispiel] Hochleistungslaser"],
        suchbegriffe: ["Ground A", "Lasertechnik"],
        regulierung: ["[Beispiel] Exportkontrolle"],
      },
      compliance: {
        regeln: ["[Beispiel] Keine Aussagen zu militärischen Anwendungen ohne Freigabe."],
        stand: "[Beispiel] 15.09.2025",
        quelle: "[Beispiel] Kommunikationsrichtlinie Ground A",
      },
      factsheet: {
        fakten: [
          { text: "[Beispiel] 230 Mitarbeitende", source: "[Beispiel] Factsheet Ground A", date: "2026-06-30" },
          { text: "[Beispiel] Gegründet 2011", source: "[Beispiel] Factsheet Ground A", date: "2026-06-30" },
          { text: "[Beispiel] 14 Patente", source: "[Beispiel] Factsheet Ground A", date: "2026-06-30" },
        ],
        boilerplate: "[Beispiel] Ground A ist ein Technologieunternehmen mit Sitz in Berlin und entwickelt Lasersysteme für Industrie und Forschung.",
      },
      styleguide: { firmenname: "[Beispiel] Ground A (mit Leerzeichen)", produktnamen: [], schreibregeln: [] },
      tone_of_voice: { beschreibung: "[Beispiel] Technisch genau, verständlich für Nichtfachleute.", referenztexte: "" },
      zielmedien: { medien: ["Hauptstadt Kurier (Wirtschaft)", "Tagesblatt Nord (Wirtschaft)"] },
    },
    speakers: [{ name: "[Beispiel] Tobias Klein", function: "Pressesprecher", topics: ["Unternehmen", "Förderung"], quoteNeedsClientApproval: false }],
  },
  Rafael: {
    sections: {
      ziele_kernbotschaften: {
        kommunikationsziele: "[Beispiel] Rafael als Partner für Luftverteidigung in Deutschland sichtbar machen.",
        kernbotschaften: [
          "[Beispiel] Rafael liefert erprobte Systeme zur Luftverteidigung.",
          "[Beispiel] Rafael ist ein verlässlicher Partner der Bundeswehr.",
          "[Beispiel] Rafael setzt auf Zusammenarbeit mit deutschen Unternehmen.",
        ],
      },
      themen_suchbegriffe: {
        themen: ["[Beispiel] Luftverteidigung", "[Beispiel] Beschaffung"],
        technologien: ["[Beispiel] Abwehrsysteme"],
        suchbegriffe: ["Rafael", "Luftverteidigung"],
        regulierung: [],
      },
      compliance: { regeln: ["[Beispiel] Keine Aussagen zu laufenden Vergabeverfahren."], stand: "[Beispiel] 01.07.2026", quelle: "[Beispiel] Richtlinie Rafael" },
      factsheet: { fakten: [], boilerplate: "[Beispiel] Rafael ist ein Rüstungsunternehmen mit Schwerpunkt Luftverteidigung." },
      styleguide: { firmenname: "[Beispiel] Rafael", produktnamen: [], schreibregeln: [] },
      tone_of_voice: { beschreibung: "[Beispiel] Zurückhaltend und faktenorientiert.", referenztexte: "" },
      zielmedien: { medien: ["Wehrtechnik Aktuell (Redaktion)", "Hauptstadt Kurier (Politik)"] },
    },
    speakers: [{ name: "[Beispiel] Daniel Roth", function: "Head of Communications", topics: ["Luftverteidigung"], quoteNeedsClientApproval: false }],
  },
};

/** Fristangaben aus BRIEFING 13.5, relativ zum Seed-Zeitpunkt. */
export type SeedDue =
  | { minutes: number }
  | { days: number }
  | { workdays: number }
  | { todayAt: string }
  | { tomorrowAt: string };

export type SeedTask = {
  client: string;
  title: string;
  format: string | null;
  owner: SeedUserKey;
  due: SeedDue;
  status: "OFFEN" | "IN_BEARBEITUNG" | "FREIGABE_ANGEFRAGT" | "AENDERUNGEN_ANGEFORDERT" | "FREIGEGEBEN" | "BEIM_KUNDEN" | "ERLEDIGT";
  category: "MEDIENARBEIT" | "DIGITALE_KOMMUNIKATION" | "EVENT" | "INTERN";
  service?: string;
  project?: string;
  approver?: SeedUserKey;
  texts?: Record<string, string>;
};

const pmStandort: Record<string, string> = {
  dachzeile: "[Beispiel] Neuer Produktionsstandort",
  headline: "[Beispiel] Covenant entscheidet sich für Standort in Sachsen",
  subheadline: "[Beispiel] Produktion soll 2028 beginnen",
  // Ortsmarke fehlt absichtlich (BRIEFING 13.5)
  ortsmarke: "",
  lead: `[Beispiel] Covenant wird einen Produktionsstandort bei Leipzig errichten. Das US-Unternehmen plant dort ${covenantFacts.contradictingJobs} neue Arbeitsplätze und will eng mit der Bundeswehr zusammenarbeiten.`,
  haupttext:
    "[Beispiel] Nach einer mehrmonatigen Prüfung mehrerer Standorte fiel die Wahl auf ein Gewerbegebiet im Norden von Leipzig. Ausschlaggebend waren die Verkehrsanbindung, die Nähe zu Zulieferern und die Fachkräfte in der Region.\n\n[Beispiel] Der Bau soll im kommenden Jahr beginnen. Die ersten Stellen werden ab Herbst ausgeschrieben.",
  zitat: "[Beispiel] „Sachsen bietet uns genau das, was wir für den Aufbau brauchen“, sagt Dr. Anna Weber, Geschäftsführerin Deutschland.",
  boilerplate: "[Beispiel] Covenant ist ein US-amerikanisches Unternehmen der Verteidigungsindustrie.",
  pressekontakt: "[Beispiel] Pressestelle Covenant Deutschland, presse@example.com",
  sperrfrist: "",
};

export const seedTasks: SeedTask[] = [
  { client: "Covenant", title: "PM Standortentscheidung", format: "PRESSEMITTEILUNG", owner: "laura", due: { minutes: 90 }, status: "FREIGABE_ANGEFRAGT", category: "MEDIENARBEIT", service: "cov_pm", texts: pmStandort },
  { client: "Covenant", title: "Q&A Standort aktualisieren", format: "QA", owner: "robin", due: { todayAt: "17:00" }, status: "IN_BEARBEITUNG", category: "MEDIENARBEIT", texts: { stand: "[Beispiel] Stand: heute", verwendung: "[Beispiel] intern", fragen: "[Beispiel] Warum Sachsen?\n\n[Beispiel] Antwort folgt." } },
  { client: "Covenant", title: "Roundtable Herbst: Konzept", format: "KONZEPT", owner: "lukas", due: { days: 10 }, status: "IN_BEARBEITUNG", category: "EVENT", project: "Roundtable Herbst", texts: { ziel: "[Beispiel] Vertrauen bei Fachjournalisten aufbauen", zielgruppe: "[Beispiel] Verteidigungs- und Wirtschaftsjournalisten" } },
  { client: "Covenant", title: "Roundtable Herbst: Einladung", format: "EINLADUNG", owner: "lukas", due: { days: 10 }, status: "IN_BEARBEITUNG", category: "EVENT", project: "Roundtable Herbst", texts: { anlass: "[Beispiel] Hintergrundgespräch zum neuen Standort" } },
  { client: "Covenant", title: "Roundtable Herbst: Agenda", format: "AGENDA", owner: "lukas", due: { days: 10 }, status: "IN_BEARBEITUNG", category: "EVENT", project: "Roundtable Herbst", texts: { titel: "[Beispiel] Roundtable Herbst" } },
  { client: "Ground A", title: "LinkedIn-Beitrag Messe", format: "LINKEDIN_POST", owner: "mika", due: { tomorrowAt: "12:00" }, status: "OFFEN", category: "DIGITALE_KOMMUNIKATION", service: "ga_linkedin" },
  { client: "Ground A", title: "Statement zur Förderung", format: "STATEMENT", owner: "juliana", due: { workdays: 3 }, status: "AENDERUNGEN_ANGEFORDERT", category: "MEDIENARBEIT", approver: "lars", texts: { sprecher: "[Beispiel] Tobias Klein, Pressesprecher", anlass: "[Beispiel] Neues Förderprogramm des Bundes", text: "[Beispiel] Wir begrüßen das Förderprogramm. Es stärkt die Lasertechnik in Deutschland." } },
  { client: "Ground A", title: "Hintergrundgespräch Hauptstadt Kurier", format: null, owner: "juliana", due: { days: 5 }, status: "OFFEN", category: "MEDIENARBEIT", service: "ga_hintergrund" },
  { client: "Rafael", title: "Pitch Luftverteidigung", format: "MEDIEN_PITCH", owner: "hannah", due: { todayAt: "15:00" }, status: "FREIGEGEBEN", category: "MEDIENARBEIT", service: "raf_pitches", approver: "lars", texts: { betreff: "[Beispiel] Gesprächsangebot zur Luftverteidigung", aufhaenger: "[Beispiel] Die Bundeswehr erhöht ihre Bestellungen.", angebot: "[Beispiel] Hintergrundgespräch mit Daniel Roth", ansprechpartner: "[Beispiel] Hannah, Rud Pedersen" } },
  { client: "Rafael", title: "Briefing für Gespräch im Ministerium", format: "BRIEFING", owner: "robin", due: { workdays: 2 }, status: "BEIM_KUNDEN", category: "MEDIENARBEIT", approver: "lars", texts: { anlass: "[Beispiel] Gespräch im Ministerium", hintergrund: "[Beispiel] Beschaffungsvorhaben Luftverteidigung", kernbotschaften: "[Beispiel] Verlässlicher Partner" } },
  { client: "SAFENET", title: "Profil aufsetzen", format: null, owner: "valentin", due: { days: 7 }, status: "OFFEN", category: "INTERN" },
  { client: "Covenant", title: "PM Spatenstich", format: "PRESSEMITTEILUNG", owner: "laura", due: { days: -20 }, status: "ERLEDIGT", category: "MEDIENARBEIT", service: "cov_pm", approver: "lukas", texts: { headline: "[Beispiel] Covenant feiert Spatenstich", ortsmarke: "[Beispiel] Leipzig, 30. September 2026" } },
];

/** Dienstplan (BRIEFING 13.6): CVD vom Dienst abwechselnd, Pressespiegel rotierend. */
export const seedShiftRotation = {
  cvd: ["lars", "lukas"] as SeedUserKey[],
  pressespiegel: ["laura", "robin", "mika", "juliana", "hannah"] as SeedUserKey[],
};
