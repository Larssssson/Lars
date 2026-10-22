import type { HealthStatus } from "../health";

/** Ablage hochgeladener Dateien (Azure Blob oder lokal). */
export interface FileStorage {
  readonly kind: "local" | "azure";
  put(key: string, data: Uint8Array, mimeType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  health(): Promise<HealthStatus>;
}
