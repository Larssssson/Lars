import { AdapterNotReadyError, requireVars } from "../errors";
import type { FileStorage } from "./types";

/** Echte Ablage in Azure Blob Storage. Implementierung in Phase 6. */
export class AzureBlobFileStorage implements FileStorage {
  readonly kind = "azure" as const;

  constructor(config: { connectionString?: string; container?: string }) {
    requireVars("Azure Blob", {
      AZURE_STORAGE_CONNECTION_STRING: config.connectionString,
      AZURE_STORAGE_CONTAINER: config.container,
    });
  }

  async put(): Promise<void> {
    throw new AdapterNotReadyError("Azure Blob");
  }

  async get(): Promise<Uint8Array> {
    throw new AdapterNotReadyError("Azure Blob");
  }

  async delete(): Promise<void> {
    throw new AdapterNotReadyError("Azure Blob");
  }

  async health() {
    return { ok: false, detail: "noch nicht implementiert" };
  }
}
