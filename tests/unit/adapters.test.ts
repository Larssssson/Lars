import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createAiProvider,
  createAuthProvider,
  createDocumentStore,
  createFileStorage,
  createMonitoringSource,
  createPushSender,
} from "@/lib/adapters";
import { AnthropicAiProvider, acceptsTemperature } from "@/lib/adapters/ai/anthropic";
import { AdapterConfigError } from "@/lib/adapters/errors";
import { readEnv } from "@/lib/env";

const base = { DATABASE_URL: "postgresql://x", NODE_ENV: "test" } as NodeJS.ProcessEnv;
const lookup = async () => null;

describe("Adapter-Auswahl per Umgebungsvariable", () => {
  it("nutzt ohne weitere Angaben überall den Ersatz", () => {
    const e = readEnv(base);
    expect(createAuthProvider(e, lookup).kind).toBe("dev");
    expect(createDocumentStore(e).kind).toBe("mock");
    expect(createFileStorage(e).kind).toBe("local");
    expect(createAiProvider(e).kind).toBe("mock");
    expect(createPushSender(e).kind).toBe("mock");
    expect(createMonitoringSource(e).kind).toBe("file");
  });

  it("schaltet auf die echten Adapter um und verlangt deren Zugangsdaten", () => {
    const e = readEnv({
      ...base,
      AUTH_PROVIDER: "entra",
      DOCUMENT_STORE: "sharepoint",
      FILE_STORAGE: "azure",
      AI_PROVIDER: "anthropic",
      PUSH_PROVIDER: "webpush",
    });
    expect(() => createAuthProvider(e, lookup)).toThrow(AdapterConfigError);
    expect(() => createDocumentStore(e)).toThrow(AdapterConfigError);
    expect(() => createFileStorage(e)).toThrow(AdapterConfigError);
    expect(() => createAiProvider(e)).toThrow(AdapterConfigError);
    expect(() => createPushSender(e)).toThrow(AdapterConfigError);
  });

  it("baut die echten Adapter, wenn Zugangsdaten gesetzt sind", () => {
    const e = readEnv({
      ...base,
      AUTH_PROVIDER: "entra",
      ENTRA_CLIENT_ID: "id",
      ENTRA_CLIENT_SECRET: "secret",
      ENTRA_TENANT_ID: "tenant",
      DOCUMENT_STORE: "sharepoint",
      SHAREPOINT_SITE_ID: "site",
      SHAREPOINT_DRIVE_ID: "drive",
      MONITORING_SOURCE: "sample",
    });
    expect(createAuthProvider(e, lookup).kind).toBe("entra");
    expect(createDocumentStore(e).kind).toBe("sharepoint");
    expect(createMonitoringSource(e).kind).toBe("sample");
  });

  it("verbietet den Entwickler-Login im Betrieb", () => {
    expect(() => readEnv({ ...base, NODE_ENV: "production", AUTH_PROVIDER: "dev" })).toThrow(/nicht erlaubt/);
  });
});

describe("Ersatz-Adapter", () => {
  let dir: string | undefined;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("DocumentStore schreibt in die SharePoint-Ordnerstruktur im Dateisystem", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "impress-"));
    const store = createDocumentStore(readEnv({ ...base, STORAGE_DIR: dir }));
    await store.putFile("Covenant/02_Pressemitteilungen/2026", "test.docx", new TextEncoder().encode("x"), "application/octet-stream");
    const written = path.join(dir, "sharepoint-mock", "impress", "Kunden", "Covenant", "02_Pressemitteilungen", "2026", "test.docx");
    expect(await readFile(written, "utf8")).toBe("x");
    expect(await store.listFolder("Covenant/02_Pressemitteilungen/2026")).toEqual(["test.docx"]);
    await expect(store.putFile("../../ausserhalb", "x.docx", new Uint8Array(), "x")).rejects.toThrow();
  });

  it("FileStorage legt Dateien ab und liest sie wieder", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "impress-"));
    const files = createFileStorage(readEnv({ ...base, STORAGE_DIR: dir }));
    await files.put("a/b.txt", new TextEncoder().encode("inhalt"), "text/plain");
    expect(new TextDecoder().decode(await files.get("a/b.txt"))).toBe("inhalt");
    await files.delete("a/b.txt");
    await expect(files.get("a/b.txt")).rejects.toThrow();
  });

  it("AiProvider liefert feste Beispielantworten und die ungültige Variante", async () => {
    const ai = createAiProvider(readEnv(base));
    const request = { functionKey: "headlines", model: "m", temperature: 0.4, system: "", prompt: "" };
    const valid = JSON.parse((await ai.complete(request)).text) as { headlines: string[] };
    expect(valid.headlines).toHaveLength(3);
    const invalid = await ai.complete({ ...request, functionKey: "lead", fixtureVariant: "invalid" });
    expect(() => JSON.parse(invalid.text)).toThrow();
  });

  it("PushSender merkt sich gesendete Nachrichten", async () => {
    const push = createPushSender(readEnv(base));
    await push.send({ userId: "u", notificationId: "n", title: "T", body: "B", link: "/" }, []);
    expect("sent" in push && push.sent).toHaveLength(1);
  });

  it("MonitoringSource liest CSV-Exporte mit Kopfzeile", async () => {
    const source = createMonitoringSource(readEnv(base));
    const csv = "Date,Headline,Source\n2026-10-19,Testmeldung,Tagesblatt Nord\n";
    const { columns, rows } = await source.readRows({ fileName: "export.csv", data: new TextEncoder().encode(csv) });
    expect(columns).toEqual(["Date", "Headline", "Source"]);
    expect(rows[0]?.Headline).toBe("Testmeldung");
  });
});

describe("Claude-Adapter (echt, ohne Netz geprüft)", () => {
  function fakeFetch(bodies: Record<string, unknown>[]) {
    return (async (_url: unknown, init?: { body?: unknown }) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: "end_turn", stop_sequence: null, content: [{ type: "text", text: '{"lead":"x"}' }], usage: { input_tokens: 1, output_tokens: 1 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
  }

  it("schickt System, Prompt und Temperatur nur an Modelle, die sie annehmen", async () => {
    const bodies: Record<string, unknown>[] = [];
    const provider = new AnthropicAiProvider({ apiKey: "test-schluessel", fetch: fakeFetch(bodies) });
    const base = { functionKey: "lead", temperature: 0.4, system: "S", prompt: "P" };
    const out = await provider.complete({ ...base, model: "claude-sonnet-5-5" });
    expect(out).toEqual({ text: '{"lead":"x"}', model: "claude-sonnet-5-5" });
    expect(bodies[0]).toMatchObject({ model: "claude-sonnet-5-5", system: "S", messages: [{ role: "user", content: "P" }] });
    expect(bodies[0]).not.toHaveProperty("temperature");
    await provider.complete({ ...base, model: "claude-sonnet-4-6" });
    expect(bodies[1]).toMatchObject({ temperature: 0.4 });
    expect(acceptsTemperature("claude-haiku-5-5")).toBe(false);
  });
});

describe("Push im Browser: Gerät und Schlüssel", () => {
  it("erkennt Plattform und Bezeichnung aus dem User-Agent", async () => {
    const { detectPlatform, deviceLabel, urlBase64ToUint8Array } = await import("@/lib/push-client");
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
    const ipad = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
    const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
    const edge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
    expect(detectPlatform(iphone)).toBe("ios");
    expect(detectPlatform(ipad, 5)).toBe("ios");
    expect(detectPlatform(ipad, 0)).toBe("desktop");
    expect(detectPlatform(android)).toBe("android");
    expect(deviceLabel(iphone)).toBe("iPhone · Safari");
    expect(deviceLabel(ipad, 5)).toBe("iPad · Safari");
    expect(deviceLabel(android)).toBe("Android · Chrome");
    expect(deviceLabel(edge)).toBe("Windows · Edge");
    expect([...urlBase64ToUint8Array("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });
});
