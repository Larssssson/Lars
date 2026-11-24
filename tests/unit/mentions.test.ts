import { describe, expect, it } from "vitest";
import { generatePassword, hashPassword, verifyPassword } from "@/lib/auth/password";
import { buildEml } from "@/lib/domain/documents/mail";
import { mentionedUsers, mentionQueryAt, splitMentions } from "@/lib/editor/mentions";

const users = [
  { id: "1", name: "Lars" },
  { id: "2", name: "Laura" },
  { id: "3", name: "Valentin Abel" },
];

describe("@-Erwähnungen (D-127)", () => {
  it("findet Vorname und vollen Namen, nicht Wortanfänge oder Mailadressen", () => {
    expect(mentionedUsers("Bitte @Laura und @valentin abel prüfen", users).map((u) => u.id)).toEqual(["2", "3"]);
    expect(mentionedUsers("@Valentin, schau mal", users).map((u) => u.id)).toEqual(["3"]);
    expect(mentionedUsers("@Larsson und lars@example.com", users)).toEqual([]);
    expect(mentionedUsers("@Lars.", users).map((u) => u.id)).toEqual(["1"]);
  });

  it("zerlegt den Text für die farbige Anzeige", () => {
    expect(splitMentions("Hallo @Laura!", users)).toEqual([{ text: "Hallo " }, { text: "@Laura", mention: users[1] }, { text: "!" }]);
  });

  it("erkennt die offene Erwähnung vor dem Cursor", () => {
    expect(mentionQueryAt("Hallo @La", 9)).toEqual({ start: 6, query: "La" });
    expect(mentionQueryAt("@", 1)).toEqual({ start: 0, query: "" });
    expect(mentionQueryAt("mail@ex", 7)).toBeNull();
    expect(mentionQueryAt("Hallo Lau", 9)).toBeNull();
  });
});

describe("Passwörter (D-125)", () => {
  it("Zufallspasswort mit vier Zeichenarten, Hash prüfbar", async () => {
    for (let i = 0; i < 20; i++) expect(generatePassword()).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!#%+?@])[A-Za-z\d!#%+?@]{8}$/);
    const hash = await hashPassword("Geheim1!");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Geheim1!", hash)).toBe(true);
    expect(await verifyPassword("geheim1!", hash)).toBe(false);
    expect(await verifyPassword("x", null)).toBe(false);
  });
});

describe("Mail-Entwurf (D-129)", () => {
  it("kodiert Umlaute im Betreff und hängt die Datei an", () => {
    const eml = buildEml({ subject: "Prüfung", body: "Grüße", attachment: { name: "a.pdf", mimeType: "application/pdf", data: new Uint8Array([37, 80, 68, 70]) } });
    expect(eml).toContain("Subject: =?UTF-8?B?");
    expect(eml).toContain('filename="a.pdf"');
    expect(eml).toContain(Buffer.from("%PDF").toString("base64"));
  });
});
