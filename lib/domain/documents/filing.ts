import type { DocumentStore } from "@/lib/adapters";
import { berlinParts } from "@/lib/time";

/** Ordnerstruktur je Kunde (BRIEFING 9), ohne Jahres- und Monatsordner. */
export const CLIENT_FOLDERS = [
  "01_Kundenprofil/Strategie_und_Ansatz",
  "01_Kundenprofil/Styleguide_und_Compliance",
  "01_Kundenprofil/Factsheets",
  "01_Kundenprofil/QA",
  "02_Pressemitteilungen",
  "03_Statements",
  "04_Medienansprache",
  "05_Social_Media",
  "06_Pressespiegel_und_Einschaetzungen",
  "07_Projekte",
  "08_Briefings_und_Konzepte",
  "99_Archiv",
] as const;

/**
 * Dateinamenteil: Umlaute umschreiben, Leerzeichen als Unterstrich, nur Buchstaben, Ziffern,
 * Bindestrich und Unterstrich (BRIEFING 9, DECISIONS D-032).
 */
export function sanitize(value: string, maxLength?: number): string {
  let result = value
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (maxLength && result.length > maxLength) result = result.slice(0, maxLength).replace(/_$/, "");
  return result;
}

export function clientFolder(shortName: string): string {
  return sanitize(shortName);
}

/** Ordnerstruktur beim Anlegen eines Kunden erzeugen (BRIEFING 9). */
export async function ensureClientFolders(store: DocumentStore, shortName: string): Promise<string> {
  const root = clientFolder(shortName);
  for (const folder of CLIENT_FOLDERS) await store.ensureFolder(`${root}/${folder}`);
  return root;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Zielordner einer finalen Datei: alles mit Projekt unter 07_Projekte/<JJJJ-MM>_<Projekttitel>,
 * sonst nach Darstellungsform mit Jahr, beim Pressespiegel zusätzlich Monat (BRIEFING 9).
 */
export function targetFolder(input: {
  shortName: string;
  formatFolder: string;
  project: { title: string; startDate: Date | null; createdAt: Date } | null;
  date: Date;
}): string {
  const root = clientFolder(input.shortName);
  const d = berlinParts(input.date);
  if (input.project) {
    const p = berlinParts(input.project.startDate ?? input.project.createdAt);
    return `${root}/07_Projekte/${p.year}-${pad(p.month)}_${sanitize(input.project.title, 60)}`;
  }
  if (input.formatFolder.startsWith("01_Kundenprofil")) return `${root}/${input.formatFolder}`;
  if (input.formatFolder === "06_Pressespiegel_und_Einschaetzungen") return `${root}/${input.formatFolder}/${d.year}/${pad(d.month)}`;
  return `${root}/${input.formatFolder}/${d.year}`;
}

/** JJJJ-MM-TT_<Kurzname>_<Darstellungsform>_<Titel>_v<Version>.docx, Titel auf 60 Zeichen (BRIEFING 9). */
export function finalFileName(input: { date: Date; shortName: string; formatName: string; title: string; version: number }): string {
  const d = berlinParts(input.date);
  return `${d.year}-${pad(d.month)}-${pad(d.day)}_${sanitize(input.shortName)}_${sanitize(input.formatName)}_${sanitize(input.title, 60)}_v${input.version}.docx`;
}
