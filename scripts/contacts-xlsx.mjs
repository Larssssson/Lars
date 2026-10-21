// Erzeugt fixtures/contacts/kontakte_sample.xlsx aus der CSV-Datei (BRIEFING 13.4). Einmalig: node scripts/contacts-xlsx.mjs
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";

const lines = (await readFile("fixtures/contacts/kontakte_sample.csv", "utf8")).trim().split("\n");
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("Kontakte");
for (const line of lines) sheet.addRow(line.split(";"));
await workbook.xlsx.writeFile("fixtures/contacts/kontakte_sample.xlsx");
