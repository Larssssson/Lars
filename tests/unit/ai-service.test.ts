import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { MockAiProvider } from "@/lib/adapters/ai/mock";
import type { AiProvider } from "@/lib/adapters";
import { AiNotAllowedError, AiOutputError, AiUnavailableError } from "@/lib/ai/errors";
import { AI_FUNCTIONS, type AiFunctionKey } from "@/lib/ai/functions";
import { loadPrompt, parsePrompt, render } from "@/lib/ai/prompts";
import { redactContactData, redactDeep } from "@/lib/ai/sanitize";
import { callAi, extractJson } from "@/lib/ai/service";
import type { PrismaClient } from "@/lib/generated/prisma/client";

/** Datenbank-Ersatz: nur, was der ai-service liest. */
function fakeDb(aiAllowed = true) {
  return {
    client: { findFirst: async () => (aiAllowed ? null : { name: "Covenant" }) },
    setting: { findUnique: async () => null },
  } as unknown as PrismaClient;
}

const FORMULATION: AiFunctionKey[] = ["headlines", "quote", "lead", "summary", "article-draft", "onboarding-questions"];

describe("Prompts (BRIEFING 8.3 Regeln 1, 5, 8)", () => {
  it("jede Funktion aus 8.1 hat einen versionierten Prompt", async () => {
    const files = (await readdir("prompts")).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
    expect(files.sort()).toEqual(Object.keys(AI_FUNCTIONS).sort());
    for (const key of Object.keys(AI_FUNCTIONS)) {
      const prompt = await loadPrompt(key);
      expect(prompt.version).toMatch(/^\d+$/);
      expect(prompt.system).toContain("Erfinde keine Zahlen");
      expect(prompt.system).toContain("[Zahl einfügen]");
    }
  });

  it("jeder Formulierungs-Prompt enthält die Stilvorgabe", async () => {
    for (const key of FORMULATION) {
      expect((await loadPrompt(key)).system).toContain("ohne Gedankenstriche als Stilmittel");
    }
  });

  it("füllt Platzhalter und lehnt unvollständige Prompts ab", () => {
    expect(render("A {{x}} B {{y}}", { x: "eins", y: { z: 1 } })).toBe('A eins B {\n "z": 1\n}');
    expect(() => parsePrompt("x", "# System\nnur System")).toThrow();
  });
});

describe("Beispielantworten (BRIEFING 13.8)", () => {
  it("gültige Antworten passen zum Schema, ungültige nicht", async () => {
    const files = await readdir("fixtures/ai");
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      const [key, variant] = file.replace(/\.json$/, "").split(".") as [AiFunctionKey, string];
      const raw = await readFile(`fixtures/ai/${file}`, "utf8");
      let ok = false;
      try {
        ok = AI_FUNCTIONS[key].schema.safeParse(extractJson(raw)).success;
      } catch {
        ok = false;
      }
      expect({ file, ok }).toEqual({ file, ok: variant === "valid" });
    }
  });
});

describe("Keine Kontaktdaten an die KI (BRIEFING 8.3 Regel 4)", () => {
  it("entfernt Mailadressen und Telefonnummern, lässt Zahlen im Text stehen", () => {
    const text = "Kontakt: jana.hofmann@example.org, +49 30 5550101 oder 030 5550150, mobil 0151 5550160. 450 Arbeitsplätze, 120 Mio. Euro, 2026.";
    const clean = redactContactData(text);
    expect(clean).not.toMatch(/@|5550101|5550150|5550160/);
    expect(clean).toContain("450 Arbeitsplätze, 120 Mio. Euro, 2026.");
    expect(redactDeep({ a: ["x@example.org"], b: { c: "+49 30 5550199" } })).toEqual({ a: ["[entfernt]"], b: { c: "[entfernt]" } });
  });
});

describe("ai-service (BRIEFING 8)", () => {
  const provider = () => new MockAiProvider("fixtures/ai");

  it("liefert geprüfte Daten mit Modell und Promptversion", async () => {
    const result = await callAi({ db: fakeDb(), ai: provider() }, "headlines", { clientIds: ["c"], vars: { text: "x" } });
    expect(result.data.headlines).toHaveLength(3);
    expect(result.model).toBe("claude-sonnet-5-5");
    expect(result.promptVersion).toBe("headlines@1");
  });

  it("versucht es bei ungültiger Ausgabe einmal erneut und meldet dann einen Fehler", async () => {
    const ai = provider();
    const spy = vi.spyOn(ai, "complete");
    await expect(callAi({ db: fakeDb(), ai }, "check", { clientIds: ["c"], vars: {}, fixtureVariant: "invalid" })).rejects.toThrow(AiOutputError);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("verweigert jeden Aufruf, wenn KI für den Kunden aus ist", async () => {
    const ai = provider();
    const spy = vi.spyOn(ai, "complete");
    await expect(callAi({ db: fakeDb(false), ai }, "lead", { clientIds: ["c"], vars: {} })).rejects.toThrow(AiNotAllowedError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("meldet einen Ausfall der Claude API verständlich", async () => {
    const broken: AiProvider = { kind: "mock", complete: async () => { throw new Error("503"); }, health: async () => ({ ok: false }) };
    await expect(callAi({ db: fakeDb(), ai: broken }, "lead", { clientIds: ["c"], vars: {} })).rejects.toThrow(AiUnavailableError);
  });

  it("schickt keine Kontaktdaten an den Anbieter", async () => {
    const ai = provider();
    const spy = vi.spyOn(ai, "complete");
    await callAi({ db: fakeDb(), ai }, "lead", { clientIds: ["c"], vars: { lead: "Pressekontakt: presse@example.com, 030 5550100", haupttext: "" } });
    expect(spy.mock.calls[0]![0].prompt).not.toMatch(/presse@example\.com|5550100/);
    expect(spy.mock.calls[0]![0].temperature).toBe(0.4);
  });
});
