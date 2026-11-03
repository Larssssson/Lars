import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { readEnv } from "@/lib/env";
import { demoPasswordMatches, proxy } from "@/proxy";

const base = { DATABASE_URL: "postgresql://x", NODE_ENV: "production", AUTH_PROVIDER: "dev" } as NodeJS.ProcessEnv;
const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`, "utf8").toString("base64")}`;

describe("Demo-Server (DECISIONS D-122)", () => {
  it("Entwickler-Login im Betrieb nur im Demo-Modus und nur mit ausreichend langem Passwort", () => {
    expect(() => readEnv(base)).toThrow(/nicht erlaubt/);
    expect(() => readEnv({ ...base, DEMO_MODE: "true" })).toThrow(/DEMO_PASSWORD/);
    expect(() => readEnv({ ...base, DEMO_MODE: "true", DEMO_PASSWORD: "kurz" })).toThrow(/mindestens 10/);
    expect(readEnv({ ...base, DEMO_MODE: "true", DEMO_PASSWORD: "lang-genug-123" }).DEMO_MODE).toBe("true");
  });

  it("prüft das gemeinsame Passwort, der Nutzername ist beliebig", () => {
    expect(demoPasswordMatches(basic("team", "geheim-1234"), "geheim-1234")).toBe(true);
    expect(demoPasswordMatches(basic("", "geheim-1234"), "geheim-1234")).toBe(true);
    expect(demoPasswordMatches(basic("team", "geheim-12345"), "geheim-1234")).toBe(false);
    expect(demoPasswordMatches(basic("team", "geheim-123"), "geheim-1234")).toBe(false);
    expect(demoPasswordMatches("Bearer x", "geheim-1234")).toBe(false);
    expect(demoPasswordMatches("Basic %%%", "geheim-1234")).toBe(false);
    expect(demoPasswordMatches(null, "geheim-1234")).toBe(false);
    expect(demoPasswordMatches(basic("ä", "pässwört-ü"), "pässwört-ü")).toBe(true);
  });

  describe("Proxy", () => {
    const saved = { mode: process.env.DEMO_MODE, pass: process.env.DEMO_PASSWORD };
    afterEach(() => {
      process.env.DEMO_MODE = saved.mode;
      process.env.DEMO_PASSWORD = saved.pass;
      if (saved.mode === undefined) delete process.env.DEMO_MODE;
      if (saved.pass === undefined) delete process.env.DEMO_PASSWORD;
    });
    const req = (path: string, auth?: string) => new NextRequest(`https://demo.example.org${path}`, { headers: auth ? { authorization: auth } : {} });

    it("lässt ohne Demo-Modus alles durch", () => {
      delete process.env.DEMO_MODE;
      expect(proxy(req("/login")).status).toBe(200);
    });

    it("verlangt im Demo-Modus das Passwort, außer für den Gesundheitsendpunkt", () => {
      process.env.DEMO_MODE = "true";
      process.env.DEMO_PASSWORD = "geheim-1234";
      const denied = proxy(req("/login"));
      expect(denied.status).toBe(401);
      expect(denied.headers.get("www-authenticate")).toMatch(/^Basic realm="impress Demo"/);
      expect(proxy(req("/_next/static/chunk.js")).status).toBe(401);
      expect(proxy(req("/login", basic("x", "falsch-1234"))).status).toBe(401);
      expect(proxy(req("/login", basic("x", "geheim-1234"))).status).toBe(200);
      expect(proxy(req("/api/health")).status).toBe(200);
    });
  });
});
