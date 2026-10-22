import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentStore } from "./types";

/** Ersatz: schreibt in ./storage/sharepoint-mock/<Wurzelpfad>/… mit derselben Struktur. */
export class MockDocumentStore implements DocumentStore {
  readonly kind = "mock" as const;

  constructor(
    private readonly baseDir: string,
    private readonly rootPath: string,
  ) {}

  private resolve(relative: string): string {
    const root = path.resolve(this.baseDir, this.rootPath);
    const target = path.resolve(root, relative);
    if (target !== root && !target.startsWith(root + path.sep)) throw new Error("Pfad außerhalb des Ablageordners.");
    return target;
  }

  async ensureFolder(folder: string): Promise<void> {
    await mkdir(this.resolve(folder), { recursive: true });
  }

  async putFile(folder: string, fileName: string, data: Uint8Array): Promise<{ url: string }> {
    await this.ensureFolder(folder);
    const target = this.resolve(path.join(folder, fileName));
    await writeFile(target, data);
    return { url: `file://${target}` };
  }

  async listFolder(folder: string): Promise<string[]> {
    try {
      return (await readdir(this.resolve(folder))).sort();
    } catch {
      return [];
    }
  }

  async health() {
    return { ok: true, detail: "Ersatz-Ablage im Dateisystem" };
  }
}
