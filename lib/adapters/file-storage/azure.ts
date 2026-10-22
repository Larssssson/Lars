import { BlobServiceClient, RestError, type ContainerClient } from "@azure/storage-blob";
import { requireVars } from "../errors";
import type { FileStorage } from "./types";

/**
 * Echte Ablage in Azure Blob Storage (BRIEFING 10.2). Azure verschlüsselt ruhende Daten selbst
 * (BRIEFING 11); der Container ist privat, Dateien liefert nur impress nach Rechteprüfung aus.
 */
export class AzureBlobFileStorage implements FileStorage {
  readonly kind = "azure" as const;
  private readonly container: ContainerClient;
  private ready: Promise<unknown> | null = null;

  constructor(config: { connectionString?: string; container?: string }) {
    const vars = requireVars("Azure Blob", {
      AZURE_STORAGE_CONNECTION_STRING: config.connectionString,
      AZURE_STORAGE_CONTAINER: config.container,
    });
    this.container = BlobServiceClient.fromConnectionString(vars.AZURE_STORAGE_CONNECTION_STRING!).getContainerClient(vars.AZURE_STORAGE_CONTAINER!);
  }

  private static check(key: string): string {
    if (!key || key.startsWith("/") || key.split("/").some((s) => s === ".." || s === "." || s === "")) throw new Error("Ungültiger Dateischlüssel.");
    return key;
  }

  /** Container beim ersten Schreiben anlegen (privat, ohne öffentlichen Zugriff). */
  private ensureContainer() {
    this.ready ??= this.container.createIfNotExists().catch((error) => {
      this.ready = null;
      throw error;
    });
    return this.ready;
  }

  async put(key: string, data: Uint8Array, mimeType: string): Promise<void> {
    await this.ensureContainer();
    await this.container.getBlockBlobClient(AzureBlobFileStorage.check(key)).uploadData(data, { blobHTTPHeaders: { blobContentType: mimeType } });
  }

  async get(key: string): Promise<Uint8Array> {
    const buffer = await this.container.getBlockBlobClient(AzureBlobFileStorage.check(key)).downloadToBuffer();
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  async delete(key: string): Promise<void> {
    await this.container.getBlockBlobClient(AzureBlobFileStorage.check(key)).deleteIfExists();
  }

  async health() {
    try {
      await this.ensureContainer();
      await this.container.getProperties();
      return { ok: true, detail: "Azure Blob erreichbar" };
    } catch (error) {
      return { ok: false, detail: error instanceof RestError ? `Azure Blob: Status ${error.statusCode ?? "?"}` : "Azure Blob nicht erreichbar" };
    }
  }
}
