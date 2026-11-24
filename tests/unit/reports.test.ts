import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { analyze, readTable, tierOf, toRows } from "@/lib/domain/reports/data";
import { atTime } from "@/lib/time";

async function sample() {
  const data = new Uint8Array(await readFile("fixtures/reports/meltwater_reporting_sample.csv"));
  return toRows(await readTable("export.csv", data));
}

const base = {
  clientName: "Covenant",
  clientAliases: [],
  competitors: ["Northwind Defence", "Helix Systems"],
  tier1: [],
  tier2: [],
  periodStart: atTime("2026-10-01", "00:00"),
  periodEnd: atTime("2026-10-31", "23:59"),
  excludePaid: true,
  topicFilter: [],
};

describe("Reporting: Export lesen (D-133)", () => {
  it("erkennt die Meltwater-Spalten und liest alle Zeilen", async () => {
    const parsed = await sample();
    expect(parsed.missing).toEqual([]);
    expect(parsed.rows.length).toBe(129);
    expect(parsed.rows[0]).toMatchObject({ outlet: "Nachrichten 24", reach: 2100000, sentiment: "neutral" });
  });

  it("meldet fehlende Pflichtspalten", () => {
    expect(toRows({ columns: ["Headline"], rows: [{ Headline: "x" }] }).missing).toEqual(["date", "outlet"]);
  });

  it("liest UTF-16 mit Tabulatoren wie aus Meltwater", async () => {
    const text = "Date\tHeadline\tSource\n2026-10-02\tÜberschrift\tTagesblatt Nord\n";
    const bytes = new Uint8Array([0xff, 0xfe, ...new Uint8Array(Buffer.from(text, "utf16le"))]);
    const parsed = toRows(await readTable("export.csv", bytes));
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.headline).toBe("Überschrift");
  });
});

describe("Reporting: Auswertung (D-133)", () => {
  it("zählt Platzierungen, Share of Voice, Tiers, Tonalität und Verlauf im Zeitraum", async () => {
    const { rows } = await sample();
    const data = analyze(rows, base);
    const october = rows.filter((r) => r.date >= base.periodStart && r.date <= base.periodEnd && !/paid/i.test(r.tags));
    const covenant = october.filter((r) => r.entityText.includes("Covenant"));
    expect(data.total).toBe(covenant.length);
    expect(data.sov.map((e) => e.name)).toEqual(["Covenant", "Northwind Defence", "Helix Systems"]);
    expect(data.sov.reduce((s, e) => s + e.count, 0)).toBe(october.length);
    expect(data.sov.reduce((s, e) => s + e.share, 0)).toBeCloseTo(1);
    expect(data.tiers[1] + data.tiers[2] + data.tiers[3]).toBe(data.total);
    expect(data.sentiment.positiv + data.sentiment.neutral + data.sentiment.negativ + data.sentiment.ohne).toBe(data.total);
    expect(data.trend.map((p) => p.month)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(data.trend.at(-1)!.client).toBe(data.total);
    expect(data.top[0]!.reach).toBeGreaterThanOrEqual(data.top[1]!.reach);
    expect(data.excludedPaid).toBeGreaterThan(0);
  });

  it("Paid nur ausschließen, wenn gewünscht; Themenfilter grenzt ein", async () => {
    const { rows } = await sample();
    expect(analyze(rows, { ...base, excludePaid: false }).total).toBeGreaterThanOrEqual(analyze(rows, base).total);
    const filtered = analyze(rows, { ...base, topicFilter: ["Arbeitsplätze"] });
    expect(filtered.total).toBeLessThan(analyze(rows, base).total);
    expect(filtered.list.every((r) => /arbeitspl/i.test(`${r.text} ${r.entityText}`))).toBe(true);
  });

  it("Tier nach eigenen Listen, sonst nach Reichweite", () => {
    expect(tierOf("Tagesblatt Nord", 10, { tier1: ["tagesblatt nord"], tier2: [] })).toBe(1);
    expect(tierOf("Anderes", 5_000_000, { tier1: ["Tagesblatt Nord"], tier2: [] })).toBe(3);
    expect(tierOf("Anderes", 5_000_000, { tier1: [], tier2: [] })).toBe(1);
    expect(tierOf("Anderes", 200_000, { tier1: [], tier2: [] })).toBe(2);
  });

  it("ein reiner Kunden-Export ohne Namen zählt alle Treffer für den Kunden", () => {
    const rows = [{ date: atTime("2026-10-05", "12:00"), headline: "Werk geplant", url: null, outlet: "X", author: null, reach: 0, sentiment: null, entityText: "", text: "Werk geplant", tags: "" }];
    expect(analyze(rows, { ...base, competitors: [] }).total).toBe(1);
  });
});
