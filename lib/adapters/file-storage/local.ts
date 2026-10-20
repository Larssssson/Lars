import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileStorage } from "./types";

/** Ersatz: Ordner ./storage/files/. */
export class LocalFileStorage implements FileStorage {
  readonly kind = "local" as const;

  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    const target = path.resolve(this.baseDir, key);
    if (!target.startsWith(path.resolve(this.baseDir) + path.sep)) throw new Error("Ungültiger Dateischlüssel.");
    return target;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async get(key: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.resolve(key)));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async health() {
    return { ok: true, detail: "Ersatz-Speicher im Dateisystem" };
  }
}
