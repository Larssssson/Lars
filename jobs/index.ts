/**
 * Hintergrundjobs mit Zeitplan (BRIEFING 10.1, 16). Zeitpläne in Europe/Berlin.
 * Phase 0 enthält nur das Gerüst; die Jobs kommen mit ihren Phasen dazu
 * (Priorität alle 5 Minuten, Eskalation, Erinnerungen, Pressespiegel-Aufgabe,
 * wöchentliche Pflege, Volltexte löschen, Archivierung).
 */
export type JobDefinition = {
  name: string;
  /** Cron-Ausdruck, null = nur auf Anforderung */
  cron: string | null;
  description: string;
  handler: () => Promise<void>;
};

export const jobs: JobDefinition[] = [];
