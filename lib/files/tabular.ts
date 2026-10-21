import ExcelJS from "exceljs";
import Papa from "papaparse";

/**
 * Tabellen aus CSV und XLSX lesen, erste Zeile als Spaltennamen. Gemeinsam für Kontaktimport und
 * Monitoring. XLSX über exceljs statt SheetJS (DECISIONS D-085).
 */
export type Table = { columns: string[]; rows: Record<string, string>[] };

export function parseCsvText(text: string): Table {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  return { columns: (result.meta.fields ?? []).filter(Boolean), rows: result.data };
}

export async function parseXlsxData(data: Uint8Array): Promise<Table> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { columns: [], rows: [] };
  const columns: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    columns[col - 1] = cell.text.trim();
  });
  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const record: Record<string, string> = {};
    columns.forEach((name, i) => {
      if (name) record[name] = row.getCell(i + 1).text.trim();
    });
    if (Object.values(record).some(Boolean)) rows.push(record);
  });
  return { columns: columns.filter(Boolean), rows };
}
