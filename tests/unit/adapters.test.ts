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
    const invalid = await ai.complete({ ...request, fixtureVariant: "invalid" });
    expect(() => JSON.parse(invalid.text)).toThrow();
  });

  it("PushSender merkt sich gesendete Nachrichten", async () => {
    const push = createPushSender(readEnv(base));
    await push.send({ userId: "u", notificationId: "n", title: "T", body: "B", link: "/" });
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
