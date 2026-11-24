import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { FileStorage } from "./types";

/**
 * Dateien in PostgreSQL (DECISIONS D-130): für den Live-Test bei Render, wo das Dateisystem bei jedem
 * Neustart leer ist. Im Betrieb in Azure gilt weiter Azure Blob.
 */
export class DatabaseFileStorage implements FileStorage {
  readonly kind = "database" as const;

  constructor(private readonly db: () => Promise<PrismaClient>) {}

  async put(key: string, data: Uint8Array, mimeType: string): Promise<void> {
    const db = await this.db();
    const bytes = new Uint8Array(data);
    await db.storedBlob.upsert({ where: { key }, update: { data: bytes, mimeType }, create: { key, data: bytes, mimeType } });
  }

  async get(key: string): Promise<Uint8Array> {
    const db = await this.db();
    const blob = await db.storedBlob.findUnique({ where: { key } });
    if (!blob) throw new Error("Datei nicht gefunden.");
    return new Uint8Array(blob.data);
  }

  async delete(key: string): Promise<void> {
    const db = await this.db();
    await db.storedBlob.deleteMany({ where: { key } });
  }

  async health() {
    try {
      await (await this.db()).storedBlob.count();
      return { ok: true, detail: "Dateien in der Datenbank" };
    } catch {
      return { ok: false, detail: "Datenbank für Dateien nicht erreichbar" };
    }
  }
}
