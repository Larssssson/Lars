import { describe, expect, it } from "vitest";
import { finalFileName, sanitize, targetFolder } from "@/lib/domain/documents/filing";
import { atTime } from "@/lib/time";

const date = atTime("2026-10-20", "11:00");

describe("SharePoint-Ablage (BRIEFING 9)", () => {
  it("baut Dateinamen wie im Beispiel", () => {
    expect(finalFileName({ date, shortName: "Covenant", formatName: "Pressemitteilung", title: "Standort Sachsen", version: 3 })).toBe(
      "2026-10-20_Covenant_Pressemitteilung_Standort_Sachsen_v3.docx",
    );
  });

  it("kürzt Titel auf 60 Zeichen und entfernt Sonderzeichen", () => {
    const name = finalFileName({ date, shortName: "Ground A", formatName: "Q&A", title: "Förderung: Was gilt? ".repeat(6), version: 1 });
    expect(name.startsWith("2026-10-20_Ground_A_QA_Foerderung_Was_gilt_")).toBe(true);
    const title = name.split("_QA_")[1]!.replace(/_v1\.docx$/, "");
    expect(title.length).toBeLessThanOrEqual(60);
    expect(sanitize("Müller & Söhne / Straße")).toBe("Mueller_Soehne_Strasse");
  });

  it("legt nach Darstellungsform, Jahr, Monat und Projekt ab", () => {
    const base = { shortName: "Covenant", date, project: null };
    expect(targetFolder({ ...base, formatFolder: "02_Pressemitteilungen" })).toBe("Covenant/02_Pressemitteilungen/2026");
    expect(targetFolder({ ...base, formatFolder: "06_Pressespiegel_und_Einschaetzungen" })).toBe("Covenant/06_Pressespiegel_und_Einschaetzungen/2026/10");
    expect(targetFolder({ ...base, formatFolder: "01_Kundenprofil/QA" })).toBe("Covenant/01_Kundenprofil/QA");
    expect(
      targetFolder({ ...base, formatFolder: "04_Medienansprache", project: { title: "Roundtable Herbst", startDate: atTime("2026-11-03", "10:00"), createdAt: date } }),
    ).toBe("Covenant/07_Projekte/2026-11_Roundtable_Herbst");
  });
});
