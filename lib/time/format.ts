import { berlinParts } from "./berlin";

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
const weekdayFormatter = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });

/** "20.10.2026, 17:00" in Berliner Zeit. */
export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/** "Di., 20.10." für einen Kalendertag. */
export function formatDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return weekdayFormatter.format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatTime(date: Date): string {
  const p = berlinParts(date);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/**
 * Relative Frist wie "in 1 Std 20 Min", "vor 3 Std", "in 2 Tagen" (BRIEFING 7.1).
 * Unter 24 Stunden in Stunden und Minuten, darüber in Kalendertagen.
 */
export function formatRelative(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  const future = diffMs >= 0;
  const abs = Math.abs(diffMs);
  const totalMinutes = Math.round(abs / 60_000);
  let text: string;
  if (totalMinutes < 1) return "jetzt";
  if (totalMinutes < 60) text = `${totalMinutes} Min`;
  else if (totalMinutes < 24 * 60) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    text = m === 0 ? `${h} Std` : `${h} Std ${m} Min`;
  } else {
    const days = Math.round(abs / 86_400_000);
    text = days === 1 ? "1 Tag" : `${days} Tagen`;
  }
  return future ? `in ${text}` : `vor ${text}`;
}

/** Wartezeit wie "seit 45 Min". */
export function formatWaiting(since: Date, now: Date): string {
  return formatRelative(since, now).replace(/^vor /, "seit ");
}
