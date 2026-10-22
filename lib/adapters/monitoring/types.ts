/** Eine Zeile aus einem Monitoring-Export, Spaltennamen wie geliefert. */
export type RawArticleRow = Record<string, string>;

export type MonitoringFile = { fileName: string; data: Uint8Array };

/**
 * Quelle für Pressespiegel-Artikel (BRIEFING 7.6). In der ersten Version nur Datei-Import;
 * Meltwater-API, RSS und Google Alerts sind spätere Implementierungen dieser Schnittstelle.
 */
export interface MonitoringSource {
  readonly kind: "file" | "sample";
  readRows(file?: MonitoringFile): Promise<{ columns: string[]; rows: RawArticleRow[] }>;
}
