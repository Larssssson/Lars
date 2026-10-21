import { describe, expect, it } from "vitest";
import { maskDetail, maskPhone, normalizeMail, normalizePhone } from "@/lib/domain/journo/contacts";
import { fileKind, guessMapping, parseContactFile } from "@/lib/domain/journo/import";

describe("Kontaktdaten (BRIEFING 7.5)", () => {
  it("normalisiert Telefonnummern nach E.164, deutsche ohne Ländervorwahl", () => {
    expect(normalizePhone("030 5550150")).toBe("+49305550150");
    expect(normalizePhone("+49 30 5550101")).toBe("+49305550101");
    expect(normalizePhone("0151 5550160")).toBe("+491515550160");
    expect(normalizePhone("12")).toBeNull();
    expect(normalizeMail("  Jana.Hofmann@Example.ORG ")).toBe("jana.hofmann@example.org");
  });

  it("verdeckt: Telefon zeigt nur die letzten 2 Ziffern, Mail gar nichts", () => {
    expect(maskPhone("+49305550101")).toBe("•••• ••• ••01");
    expect(maskDetail("MAIL", "jana.hofmann@example.org")).not.toMatch(/jana|example/);
  });
});

describe("Import-Dateien (BRIEFING 7.5)", () => {
  it("erkennt Formate und schlägt eine Zuordnung vor", () => {
    expect(fileKind("a.CSV")).toBe("CSV");
    expect(fileKind("a.xlsx")).toBe("XLSX");
    expect(fileKind("a.vcf")).toBe("VCF");
    expect(fileKind("a.pdf")).toBeNull();
    expect(guessMapping(["First Name", "Last Name", "Company", "Mobile", "Phone", "Email", "Sonstiges"])).toEqual({
      "First Name": "firstName",
      "Last Name": "lastName",
      Company: "media",
      Mobile: "phone2",
      Phone: "phone",
      Email: "email",
      Sonstiges: "",
    });
  });

  it("liest CSV mit Semikolon oder Komma und vCard mit gefalteten Zeilen", async () => {
    const csv = await parseContactFile({ name: "k.csv", data: new TextEncoder().encode("﻿Name,Medium\nKarl Fischer,Wehrtechnik Aktuell\n") });
    expect(csv).toEqual({ kind: "CSV", columns: ["Name", "Medium"], rows: [{ Name: "Karl Fischer", Medium: "Wehrtechnik Aktuell" }] });
    const vcf = "BEGIN:VCARD\r\nVERSION:3.0\r\nN:Fischer;Karl;;;\r\nFN:Karl Fischer\r\nNOTE:sehr lange Notiz, die über\r\n  zwei Zeilen geht\r\nEND:VCARD\r\n";
    const parsed = await parseContactFile({ name: "k.vcf", data: new TextEncoder().encode(vcf) });
    expect(parsed.rows[0]).toMatchObject({ Vorname: "Karl", Nachname: "Fischer", Notiz: "sehr lange Notiz, die über zwei Zeilen geht" });
    await expect(parseContactFile({ name: "k.vcf", data: new TextEncoder().encode("kein vcard") })).rejects.toThrow(/CSV-, XLSX- oder vCard/);
  });
});
