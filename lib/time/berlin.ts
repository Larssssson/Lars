/**
 * Zeitrechnung in Europe/Berlin (BRIEFING 5: in UTC speichern, in Berlin anzeigen).
 * Ohne Bibliothek, über Intl; Sommerzeitwechsel werden korrekt behandelt.
 */
export const TIME_ZONE = "Europe/Berlin";

export type BerlinParts = {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  /** ISO-Wochentag, 1 = Montag … 7 = Sonntag */
  weekday: number;
};

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function berlinParts(date: Date): BerlinParts {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday ?? ""] ?? 0,
  };
}

/** Abstand Berlin zu UTC in Millisekunden zum Zeitpunkt utcMs. */
function offsetAt(utcMs: number): number {
  const p = berlinParts(new Date(utcMs));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(utcMs / 60_000) * 60_000;
}

/** Ortszeit in Berlin → UTC-Zeitpunkt. Nicht existierende Zeiten (Sommerzeitbeginn) rücken vor. */
export function fromBerlin(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let result = guess - offsetAt(guess);
  const corrected = guess - offsetAt(result);
  if (corrected !== result) result = corrected;
  return new Date(result);
}

/** Kalendertag in Berlin als "JJJJ-MM-TT". */
export type DateKey = string;

export function dateKey(date: Date): DateKey {
  const p = berlinParts(date);
  return toKey(p.year, p.month, p.day);
}

export function toKey(year: number, month: number, day: number): DateKey {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseKey(key: DateKey): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) throw new Error(`Ungültiges Datum: ${key}`);
  return { year, month, day };
}

/** Kalendertag plus n Tage (reine Kalenderrechnung, unabhängig von Zeitzonen). */
export function addDays(key: DateKey, days: number): DateKey {
  const { year, month, day } = parseKey(key);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return toKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** ISO-Wochentag eines Kalendertags. */
export function weekdayOf(key: DateKey): number {
  const { year, month, day } = parseKey(key);
  const w = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return w === 0 ? 7 : w;
}

/** Montag der Woche, in der der Kalendertag liegt. */
export function mondayOf(key: DateKey): DateKey {
  return addDays(key, 1 - weekdayOf(key));
}

/** Beginn eines Kalendertags in Berlin als UTC-Zeitpunkt. */
export function startOfDay(key: DateKey): Date {
  const { year, month, day } = parseKey(key);
  return fromBerlin(year, month, day, 0, 0);
}

/** Uhrzeit "HH:MM" an einem Kalendertag in Berlin als UTC-Zeitpunkt. */
export function atTime(key: DateKey, time: string): Date {
  const { year, month, day } = parseKey(key);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return fromBerlin(year, month, day, hour, minute);
}

/** Wert für <input type="datetime-local"> in Berliner Ortszeit. */
export function toLocalInput(date: Date): string {
  const p = berlinParts(date);
  return `${toKey(p.year, p.month, p.day)}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** Wert aus <input type="datetime-local"> (Berliner Ortszeit) → UTC-Zeitpunkt. */
export function fromLocalInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  return fromBerlin(y, mo, d, h, mi);
}
