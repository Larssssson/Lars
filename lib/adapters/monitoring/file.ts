import { readFile } from "node:fs/promises";
import { parseCsvText, parseXlsxData } from "@/lib/files/tabular";
import type { MonitoringFile, MonitoringSource } from "./types";

/** Datei-Import: Meltwater-Export als CSV oder XLSX (BRIEFING 7.6). */
export class FileMonitoringSource implements MonitoringSource {
  readonly kind: "file" | "sample" = "file";

  async readRows(file?: MonitoringFile) {
    if (!file) throw new Error("Keine Datei übergeben.");
    const name = file.fileName.toLowerCase();
    if (name.endsWith(".csv")) return parseCsvText(new TextDecoder("utf-8").decode(file.data));
    if (name.endsWith(".xlsx")) return parseXlsxData(file.data);
    throw new Error("Dieses Dateiformat wird nicht unterstützt.");
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
