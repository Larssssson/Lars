import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

/** Höchstens so viele Zeichen gehen aus Unterlagen an die KI (BRIEFING 2.9: so wenig Daten wie nötig). */
export const MAX_DOCUMENT_CHARS = 40_000;

/**
 * Text aus hochgeladenen Unterlagen für die Profilvorschläge (BRIEFING 6.8): PDF, Word, Text.
 * Der Text wird nicht gespeichert, nur an die KI übergeben.
 */
export async function extractDocumentText(file: { name: string; mimeType: string; data: Uint8Array }): Promise<string> {
  const name = file.name.toLowerCase();
  let text = "";
  if (file.mimeType === "application/pdf" || name.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(file.data));
    const result = await extractText(pdf, { mergePages: true });
    text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
  } else if (name.endsWith(".docx")) {
    text = (await mammoth.extractRawText({ buffer: Buffer.from(file.data) })).value;
  } else if (file.mimeType.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) {
    text = new TextDecoder("utf-8").decode(file.data);
  }
  return text.replace(/\s+\n/g, "\n").trim().slice(0, MAX_DOCUMENT_CHARS);
}
