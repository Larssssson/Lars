import { readFile } from "node:fs/promises";
import Papa from "papaparse";
import type { MonitoringFile, MonitoringSource, RawArticleRow } from "./types";

function parseCsv(text: string): { columns: string[]; rows: RawArticleRow[] } {
  const result = Papa.parse<RawArticleRow>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  return { columns: result.meta.fields ?? [], rows: result.data };
}

/** Datei-Import (Meltwater CSV; XLSX folgt in Phase 5). */
export class FileMonitoringSource implements MonitoringSource {
  readonly kind: "file" | "sample" = "file";

  async readRows(file?: MonitoringFile) {
    if (!file) throw new Error("Keine Datei übergeben.");
    if (!file.fileName.toLowerCase().endsWith(".csv")) {
      throw new Error("Dieses Dateiformat wird noch nicht unterstützt.");
    }
    return parseCsv(new TextDecoder("utf-8").decode(file.data));
  }
}

/** Ersatz: derselbe Datei-Import, liest ohne Upload die Beispieldatei aus fixtures/monitoring/. */
export class SampleMonitoringSource extends FileMonitoringSource {
  override readonly kind = "sample" as const;

  constructor(private readonly samplePath: string) {
    super();
  }

  override async readRows(file?: MonitoringFile) {
    if (file) return super.readRows(file);
    const data = new Uint8Array(await readFile(this.samplePath));
    return super.readRows({ fileName: this.samplePath, data });
  }
}
