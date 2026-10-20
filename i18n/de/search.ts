export const search = {
  title: "Suche",
  resultsFor: (q: string) => `Ergebnisse für „${q}“`,
  tooShort: "Bitte mindestens zwei Zeichen eingeben.",
  tasks: "Aufgaben",
  clients: "Kunden",
  none: "Nichts gefunden.",
  laterHint: "Dokumente und Kontakte kommen mit Phase 2 und 4 dazu.",
} as const;
