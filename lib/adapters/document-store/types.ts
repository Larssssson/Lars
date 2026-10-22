import type { HealthStatus } from "../health";

/** Ablage finaler Texte im SharePoint (BRIEFING 9). Pfade relativ zum Wurzelpfad. */
export interface DocumentStore {
  readonly kind: "mock" | "sharepoint";
  ensureFolder(path: string): Promise<void>;
  putFile(path: string, fileName: string, data: Uint8Array, mimeType: string): Promise<{ url: string }>;
  listFolder(path: string): Promise<string[]>;
  health(): Promise<HealthStatus>;
}
