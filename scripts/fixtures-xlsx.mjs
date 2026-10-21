// Erzeugt die XLSX-Fassungen der Beispieldateien aus den CSV-Dateien (BRIEFING 13.3, 13.4).
// Einmalig: node scripts/fixtures-xlsx.mjs
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import Papa from "papaparse";

const files = [
  { csv: "fixtures/contacts/kontakte_sample.csv", xlsx: "fixtures/contacts/kontakte_sample.xlsx", sheet: "Kontakte" },
  { csv: "fixtures/monitoring/meltwater_sample.csv", xlsx: "fixtures/monitoring/meltwater_sample.xlsx", sheet: "Meltwater" },
];
for (const f of files) {
  const { data } = Papa.parse((await readFile(f.csv, "utf8")).trim(), { skipEmptyLines: true });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(f.sheet);
  for (const row of data) sheet.addRow(row);
  await workbook.xlsx.writeFile(f.xlsx);
}
