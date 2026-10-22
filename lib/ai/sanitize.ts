/**
 * Telefonnummern und Mailadressen gehen nie an die KI (BRIEFING 8.3 Regel 4, Abschnitt 11).
 * Ersetzt in allen Zeichenketten der Eingabe, rekursiv.
 */
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// internationale (+49, 0049) oder nationale (030, 0151) Nummern; Ziffergruppen nur durch ein
// Leerzeichen, einen Schrägstrich oder Bindestrich getrennt; mindestens 7 Ziffern
const PHONE = /(?:\+|\b00)\d{1,3}(?:[ /-]?\(?\d+\)?)+|\b0\d{2,5}(?:[ /-]?\d+)+/g;
export const REDACTED = "[entfernt]";

export function redactContactData(text: string): string {
  return text.replace(EMAIL, REDACTED).replace(PHONE, (match) => (match.replace(/\D/g, "").length >= 7 ? REDACTED : match));
}

export function redactDeep<T>(value: T): T {
  if (typeof value === "string") return redactContactData(value) as T;
  if (Array.isArray(value)) return value.map(redactDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactDeep(v)])) as T;
  }
  return value;
}
