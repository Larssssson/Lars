export const search = {
  title: "Suche",
  resultsFor: (q: string) => `Ergebnisse für „${q}“`,
  tooShort: "Bitte mindestens zwei Zeichen eingeben.",
  tasks: "Aufgaben",
  clients: "Kunden",
  none: "Nichts gefunden.",
  laterHint: "Gesucht wird in Aufgaben, Texten der Dokumente und Kunden. Kontakte kommen mit Phase 4 dazu.",
} as const;
