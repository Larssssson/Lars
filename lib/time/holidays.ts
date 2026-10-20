import { addDays, toKey, weekdayOf, type DateKey } from "./berlin";

/** Ostersonntag nach der Gaußschen Osterformel (Anonymer Gregorianischer Algorithmus). */
function easterSunday(year: number): DateKey {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toKey(year, month, day);
}

const cache = new Map<number, Map<DateKey, string>>();

/** Gesetzliche Feiertage in Berlin (DECISIONS D-014). */
export function berlinHolidays(year: number): Map<DateKey, string> {
  const cached = cache.get(year);
  if (cached) return cached;
  const easter = easterSunday(year);
  const list: [DateKey, string][] = [
    [toKey(year, 1, 1), "Neujahr"],
    [toKey(year, 3, 8), "Internationaler Frauentag"],
    [addDays(easter, -2), "Karfreitag"],
    [addDays(easter, 1), "Ostermontag"],
    [toKey(year, 5, 1), "Tag der Arbeit"],
    [addDays(easter, 39), "Christi Himmelfahrt"],
    [addDays(easter, 50), "Pfingstmontag"],
    [toKey(year, 10, 3), "Tag der Deutschen Einheit"],
    [toKey(year, 12, 25), "1. Weihnachtstag"],
    [toKey(year, 12, 26), "2. Weihnachtstag"],
  ];
  const map = new Map(list);
  cache.set(year, map);
  return map;
}

export function isHoliday(key: DateKey): boolean {
  return berlinHolidays(Number(key.slice(0, 4))).has(key);
}

/** Werktag: Montag bis Freitag ohne Feiertage in Berlin (BRIEFING 6.2). */
export function isWorkday(key: DateKey): boolean {
  return weekdayOf(key) <= 5 && !isHoliday(key);
}

/** n-ter Werktag nach dem Kalendertag (der Tag selbst zählt nicht). */
export function addWorkdays(key: DateKey, n: number): DateKey {
  let current = key;
  let remaining = n;
  while (remaining > 0) {
    current = addDays(current, 1);
    if (isWorkday(current)) remaining -= 1;
  }
  return current;
}
