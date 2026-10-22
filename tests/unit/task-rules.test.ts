import { describe, expect, it } from "vitest";
import {
  canTransitionSimpleTask,
  compareTasks,
  computePriority,
  dashboardGroup,
  dueOptions,
} from "@/lib/domain/tasks/rules";
import { atTime, toLocalInput } from "@/lib/time";

// Dienstag, 20.10.2026, 10:00 Uhr in Berlin
const now = atTime("2026-10-20", "10:00");
const minutes = (n: number) => new Date(now.getTime() + n * 60_000);

describe("Priorität (BRIEFING 6.2)", () => {
  it("Dringend: Frist in höchstens 2 Stunden oder überschritten", () => {
    expect(computePriority(minutes(90), null, now)).toBe("DRINGEND");
    expect(computePriority(minutes(120), null, now)).toBe("DRINGEND");
    expect(computePriority(minutes(-60 * 24 * 20), null, now)).toBe("DRINGEND");
  });

  it("Dringend: vom CVD markiert, unabhängig von der Frist", () => {
    expect(computePriority(atTime("2026-12-01", "12:00"), "DRINGEND", now)).toBe("DRINGEND");
  });

  it("Hoch: Frist heute", () => {
    expect(computePriority(minutes(121), null, now)).toBe("HOCH");
    expect(computePriority(atTime("2026-10-20", "23:59"), null, now)).toBe("HOCH");
  });

  it("Normal: Frist in den nächsten 3 Werktagen", () => {
    expect(computePriority(atTime("2026-10-21", "00:00"), null, now)).toBe("NORMAL");
    expect(computePriority(atTime("2026-10-23", "23:59"), null, now)).toBe("NORMAL");
  });

  it("Niedrig: Frist später", () => {
    expect(computePriority(atTime("2026-10-24", "09:00"), null, now)).toBe("NIEDRIG");
    expect(computePriority(atTime("2026-10-26", "09:00"), null, now)).toBe("NIEDRIG");
  });

  it("Werktage überspringen Wochenende und Feiertage", () => {
    const friday = atTime("2026-10-23", "10:00");
    // Fr + 3 Werktage = Mi 28.10.
    expect(computePriority(atTime("2026-10-28", "18:00"), null, friday)).toBe("NORMAL");
    expect(computePriority(atTime("2026-10-29", "08:00"), null, friday)).toBe("NIEDRIG");
    const beforeChristmas = atTime("2026-12-23", "10:00"); // Mi; 25./26.12. Feiertage
    expect(computePriority(atTime("2026-12-29", "12:00"), null, beforeChristmas)).toBe("NORMAL");
    expect(computePriority(atTime("2026-12-30", "12:00"), null, beforeChristmas)).toBe("NIEDRIG");
  });

  it("sortiert nach Priorität, dann Frist, dann Anlagedatum", () => {
    const a = { id: "a", priority: "NORMAL" as const, dueAt: minutes(3000), createdAt: minutes(-10) };
    const b = { id: "b", priority: "DRINGEND" as const, dueAt: minutes(60), createdAt: minutes(-5) };
    const c = { id: "c", priority: "NORMAL" as const, dueAt: minutes(3000), createdAt: minutes(-20) };
    const d = { id: "d", priority: "NORMAL" as const, dueAt: minutes(2000), createdAt: minutes(-1) };
    expect([a, b, c, d].sort(compareTasks).map((t) => t.id)).toEqual(["b", "d", "c", "a"]);
  });

  it("gruppiert auf dem Dashboard nach Dringend, Heute, Demnächst", () => {
    expect(["DRINGEND", "HOCH", "NORMAL", "NIEDRIG"].map((p) => dashboardGroup(p as never))).toEqual([
      "DRINGEND", "HEUTE", "DEMNAECHST", "DEMNAECHST",
    ]);
  });
});

describe("Schnellwahl für die Frist (BRIEFING 6.1)", () => {
  it("bietet die vier Schnellwahlen in Berliner Zeit", () => {
    const o = dueOptions(now);
    expect(toLocalInput(o.IN_2_STUNDEN)).toBe("2026-10-20T12:00");
    expect(toLocalInput(o.HEUTE_17)).toBe("2026-10-20T17:00");
    expect(toLocalInput(o.MORGEN_12)).toBe("2026-10-21T12:00");
    expect(toLocalInput(o.IN_3_WERKTAGEN)).toBe("2026-10-23T10:00");
  });
});

describe("Status einfacher Aufgaben (BRIEFING 6.3)", () => {
  it("erlaubt Offen, In Bearbeitung, Erledigt, Archiviert", () => {
    expect(canTransitionSimpleTask("OFFEN", "IN_BEARBEITUNG")).toBe(true);
    expect(canTransitionSimpleTask("IN_BEARBEITUNG", "ERLEDIGT")).toBe(true);
    expect(canTransitionSimpleTask("OFFEN", "ERLEDIGT")).toBe(true);
    expect(canTransitionSimpleTask("ERLEDIGT", "IN_BEARBEITUNG")).toBe(true);
    expect(canTransitionSimpleTask("ERLEDIGT", "ARCHIVIERT")).toBe(true);
  });

  it("verbietet Dokument-Status und Rückkehr aus dem Archiv", () => {
    expect(canTransitionSimpleTask("OFFEN", "FREIGABE_ANGEFRAGT")).toBe(false);
    expect(canTransitionSimpleTask("OFFEN", "ARCHIVIERT")).toBe(false);
    expect(canTransitionSimpleTask("ARCHIVIERT", "OFFEN")).toBe(false);
  });
});
