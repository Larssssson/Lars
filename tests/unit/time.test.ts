import { describe, expect, it } from "vitest";
import {
  addWorkdays,
  atTime,
  berlinHolidays,
  dateKey,
  formatRelative,
  fromBerlin,
  fromLocalInput,
  isWorkday,
  mondayOf,
  toLocalInput,
  weekdayOf,
} from "@/lib/time";

describe("Berliner Zeit", () => {
  it("rechnet Ortszeit in UTC um, im Sommer und im Winter", () => {
    expect(fromBerlin(2026, 7, 1, 12, 0).toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(fromBerlin(2026, 12, 1, 12, 0).toISOString()).toBe("2026-12-01T11:00:00.000Z");
  });

  it("behandelt die Sommerzeitwechsel", () => {
    // 25.10.2026: 03:00 MESZ → 02:00 MEZ
    expect(fromBerlin(2026, 10, 25, 1, 30).toISOString()).toBe("2026-10-24T23:30:00.000Z");
    expect(fromBerlin(2026, 10, 25, 12, 0).toISOString()).toBe("2026-10-25T11:00:00.000Z");
    // 29.03.2026: 02:30 gibt es nicht und rückt vor
    expect(fromBerlin(2026, 3, 29, 2, 30).toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  it("bestimmt den Kalendertag in Berlin, nicht in UTC", () => {
    expect(dateKey(new Date("2026-10-20T22:30:00Z"))).toBe("2026-10-21");
    expect(dateKey(new Date("2026-10-20T21:30:00Z"))).toBe("2026-10-20");
  });

  it("liest und schreibt Werte für datetime-local", () => {
    const d = atTime("2026-10-20", "17:00");
    expect(toLocalInput(d)).toBe("2026-10-20T17:00");
    expect(fromLocalInput("2026-10-20T17:00")?.toISOString()).toBe(d.toISOString());
    expect(fromLocalInput("kein Datum")).toBeNull();
  });

  it("kennt Wochentage und Wochenanfang", () => {
    expect(weekdayOf("2026-10-20")).toBe(2);
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
  });
});

describe("Feiertage und Werktage in Berlin (DECISIONS D-014)", () => {
  it("enthält die zehn gesetzlichen Feiertage 2026", () => {
    const h = berlinHolidays(2026);
    expect([...h.keys()].sort()).toEqual([
      "2026-01-01", "2026-03-08", "2026-04-03", "2026-04-06", "2026-05-01",
      "2026-05-14", "2026-05-25", "2026-10-03", "2026-12-25", "2026-12-26",
    ]);
  });

  it("zählt Werktage ohne Wochenende und Feiertage", () => {
    expect(isWorkday("2026-10-20")).toBe(true);
    expect(isWorkday("2026-10-24")).toBe(false);
    expect(isWorkday("2026-10-03")).toBe(false);
    expect(addWorkdays("2026-10-20", 3)).toBe("2026-10-23");
    expect(addWorkdays("2026-10-22", 3)).toBe("2026-10-27");
    // über Weihnachten: 23.12. (Mi) + 3 Werktage = 24., 28., 29.
    expect(addWorkdays("2026-12-23", 3)).toBe("2026-12-29");
  });
});

describe("Relative Fristen (BRIEFING 7.1)", () => {
  const now = new Date("2026-10-20T08:00:00Z");
  it("schreibt Stunden und Minuten unter einem Tag", () => {
    expect(formatRelative(new Date(now.getTime() + 80 * 60_000), now)).toBe("in 1 Std 20 Min");
    expect(formatRelative(new Date(now.getTime() + 45 * 60_000), now)).toBe("in 45 Min");
    expect(formatRelative(new Date(now.getTime() - 3 * 3_600_000), now)).toBe("vor 3 Std");
  });
  it("schreibt Tage ab einem Tag", () => {
    expect(formatRelative(new Date(now.getTime() + 2 * 86_400_000), now)).toBe("in 2 Tagen");
    expect(formatRelative(new Date(now.getTime() - 86_400_000), now)).toBe("vor 1 Tag");
  });
});
