import { createECDH, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import webpush from "web-push";
import { AnthropicAiProvider } from "@/lib/adapters/ai/anthropic";
import { EntraAuthProvider, entraProfile } from "@/lib/adapters/auth/entra";
import { SharePointDocumentStore } from "@/lib/adapters/document-store/sharepoint";
import { AzureBlobFileStorage } from "@/lib/adapters/file-storage/azure";
import { WebPushSender } from "@/lib/adapters/push/webpush";
import { Agent } from "node:https";
import { json, mockServer, selfSignedCert, startAzurite } from "./servers";

/**
 * Echte Adapter gegen Testumgebungen (BRIEFING 12, Phase 6): Azure Blob gegen Azurite,
 * Microsoft Graph, Entra ID, Claude API und einen Push-Dienst gegen lokale Mock-Server,
 * die die jeweiligen HTTP-Schnittstellen nachbilden.
 */

describe("Azure Blob gegen Azurite", () => {
  let azurite: Awaited<ReturnType<typeof startAzurite>>;
  beforeAll(async () => {
    azurite = await startAzurite();
  }, 30_000);
  afterAll(async () => {
    await azurite?.stop();
  });

  it("legt den Container an, speichert, liest und löscht Dateien", async () => {
    const files = new AzureBlobFileStorage({ connectionString: azurite.connectionString, container: "impress-test" });
    expect(await files.health()).toEqual({ ok: true, detail: "Azure Blob erreichbar" });
    await files.put("clients/abc/logo.png", new TextEncoder().encode("bild"), "image/png");
    expect(new TextDecoder().decode(await files.get("clients/abc/logo.png"))).toBe("bild");
    await files.put("clients/abc/logo.png", new TextEncoder().encode("neu"), "image/png");
    expect(new TextDecoder().decode(await files.get("clients/abc/logo.png"))).toBe("neu");
    await files.delete("clients/abc/logo.png");
    await expect(files.get("clients/abc/logo.png")).rejects.toThrow();
    await files.delete("gibt-es-nicht");
    await expect(files.put("../ausserhalb", new Uint8Array(), "text/plain")).rejects.toThrow("Ungültiger Dateischlüssel");
  });

  it("meldet einen nicht erreichbaren Speicher in der Gesundheitsprüfung", async () => {
    const files = new AzureBlobFileStorage({
      connectionString: azurite.connectionString.replace(/BlobEndpoint=[^;]+/, "BlobEndpoint=http://127.0.0.1:9/devstoreaccount1"),
      container: "impress-test",
    });
    expect((await files.health()).ok).toBe(false);
  }, 60_000);
});

describe("SharePoint über Microsoft Graph (Mock-Server)", () => {
  /** Ordnerbaum der Bibliothek: Pfad → Kinder */
  const tree = new Map<string, Map<string, { folder: boolean; data?: Buffer }>>([["", new Map()]]);
  let server: Awaited<ReturnType<typeof mockServer>>;
  const tokens: string[] = [];

  beforeAll(async () => {
    server = await mockServer(async (req, res) => {
      const url = new URL(req.url, "http://x");
      if (url.pathname === "/login/tenant-1/oauth2/v2.0/token") {
        const form = new URLSearchParams(req.body.toString());
        if (form.get("client_secret") !== "geheim-test" || form.get("grant_type") !== "client_credentials") return json(res, 401, { error: "invalid_client" });
        tokens.push("t1");
        return json(res, 200, { access_token: "t1", expires_in: 3600, token_type: "Bearer" });
      }
      if (req.headers.authorization !== "Bearer t1") return json(res, 401, { error: { code: "InvalidAuthenticationToken" } });
      if (url.pathname === "/graph/sites/site-1/drives/drive-1") return json(res, 200, { id: "drive-1" });
      const m = /^\/graph\/drives\/drive-1\/root(?::\/(.*?):)?(\/children|\/content)$/.exec(url.pathname);
      if (!m) return json(res, 404, { error: { code: "itemNotFound" } });
      const itemPath = decodeURIComponent(m[1] ?? "");
      if (m[2] === "/children" && req.method === "POST") {
        const children = tree.get(itemPath);
        if (!children) return json(res, 404, { error: { code: "itemNotFound" } });
        const { name } = JSON.parse(req.body.toString()) as { name: string };
        if (children.has(name)) return json(res, 409, { error: { code: "nameAlreadyExists" } });
        children.set(name, { folder: true });
        tree.set(itemPath ? `${itemPath}/${name}` : name, new Map());
        return json(res, 201, { name });
      }
      if (m[2] === "/children") {
        const children = tree.get(itemPath);
        if (!children) return json(res, 404, { error: { code: "itemNotFound" } });
        const names = [...children.keys()];
        // zweite Seite, damit das Weiterblättern geprüft ist
        if (!url.searchParams.has("page") && names.length > 1) {
          return json(res, 200, { value: names.slice(0, 1).map((name) => ({ name })), "@odata.nextLink": `${server.url}${url.pathname}?page=2` });
        }
        return json(res, 200, { value: (url.searchParams.has("page") ? names.slice(1) : names).map((name) => ({ name })) });
      }
      if (m[2] === "/content" && req.method === "PUT") {
        const parent = itemPath.split("/").slice(0, -1).join("/");
        const name = itemPath.split("/").at(-1)!;
        const children = tree.get(parent);
        if (!children) return json(res, 404, { error: { code: "itemNotFound" } });
        children.set(name, { folder: false, data: req.body });
        return json(res, 201, { name, webUrl: `https://rp.sharepoint.example/${itemPath}` });
      }
      json(res, 405, {});
    });
  });
  afterAll(async () => {
    await server?.close();
  });

  const store = () =>
    new SharePointDocumentStore({
      siteId: "site-1",
      driveId: "drive-1",
      rootPath: "impress/Kunden",
      tenantId: "tenant-1",
      clientId: "app-1",
      clientSecret: "geheim-test",
      graphBaseUrl: `${server.url}/graph`,
      loginBaseUrl: `${server.url}/login`,
    });

  it("legt die Ordnerstruktur an, lädt Dateien hoch und listet sie, mit einem Token", async () => {
    const s = store();
    expect(await s.health()).toEqual({ ok: true, detail: "SharePoint erreichbar" });
    const { url } = await s.putFile("Covenant/02_Pressemitteilungen/2026", "2026-10-20 PM Standort Sachsen.docx", new TextEncoder().encode("docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(url).toBe("https://rp.sharepoint.example/impress/Kunden/Covenant/02_Pressemitteilungen/2026/2026-10-20 PM Standort Sachsen.docx");
    expect(tree.get("impress/Kunden/Covenant/02_Pressemitteilungen/2026")?.get("2026-10-20 PM Standort Sachsen.docx")?.data?.toString()).toBe("docx");
    await s.putFile("Covenant/02_Pressemitteilungen/2026", "zweite.pdf", new TextEncoder().encode("pdf"), "application/pdf");
    expect(await s.listFolder("Covenant/02_Pressemitteilungen/2026")).toEqual(["2026-10-20 PM Standort Sachsen.docx", "zweite.pdf"]);
    expect(await s.listFolder("Gibt/Es/Nicht")).toEqual([]);
    expect(tokens).toHaveLength(1);
    // Umlaute und Leerzeichen kommen kodiert an
    expect(server.requests.some((r) => r.url.includes("2026-10-20%20PM%20Standort%20Sachsen.docx"))).toBe(true);
    await expect(s.putFile("../ausserhalb", "x.docx", new Uint8Array(), "x")).rejects.toThrow("außerhalb");
  });

  it("meldet falsche Zugangsdaten in der Gesundheitsprüfung", async () => {
    const s = new SharePointDocumentStore({
      siteId: "site-1", driveId: "drive-1", rootPath: "impress/Kunden", tenantId: "tenant-1", clientId: "app-1", clientSecret: "falsch",
      graphBaseUrl: `${server.url}/graph`, loginBaseUrl: `${server.url}/login`,
    });
    expect(await s.health()).toEqual({ ok: false, detail: "Microsoft Graph: Status 401 (token)" });
  });
});

describe("Entra ID (Mock-Server)", () => {
  it("prüft den Mandanten über die OpenID-Konfiguration und liest nur Name und Mail", async () => {
    const server = await mockServer((req, res) =>
      req.url === "/tenant-1/v2.0/.well-known/openid-configuration" ? json(res, 200, { issuer: "https://login.example/tenant-1/v2.0" }) : json(res, 404, {}),
    );
    try {
      const ok = new EntraAuthProvider({ clientId: "app", clientSecret: "s", tenantId: "tenant-1", loginBaseUrl: server.url });
      expect(await ok.health()).toEqual({ ok: true, detail: "Entra ID erreichbar" });
      const wrong = new EntraAuthProvider({ clientId: "app", clientSecret: "s", tenantId: "anderer", loginBaseUrl: server.url });
      expect(await wrong.health()).toEqual({ ok: false, detail: "Entra ID: Status 404" });
      const provider = ok.providers()[0] as unknown as { options: { issuer: string; authorization: { params: { scope: string } } } };
      expect(provider.options.issuer).toBe(`${server.url}/tenant-1/v2.0`);
      expect(provider.options.authorization.params.scope).toBe("openid profile email");
    } finally {
      await server.close();
    }
    expect(entraProfile({ sub: "s1", name: "Laura Beispiel", preferred_username: "Laura@Example.com" })).toEqual({ id: "s1", name: "Laura Beispiel", email: "laura@example.com", image: null });
    expect(entraProfile({ sub: "s2", name: "X", email: "x@example.com", preferred_username: "upn@example.com" }).email).toBe("x@example.com");
  });
});

describe("Claude API (Mock-Server)", () => {
  it("sendet die Anfrage mit Schlüssel an die Messages-Schnittstelle und meldet Fehler", async () => {
    const server = await mockServer((req, res) => {
      if (req.headers["x-api-key"] !== "test-schluessel") return json(res, 401, { type: "error", error: { type: "authentication_error", message: "x" } });
      if (req.url.startsWith("/v1/models")) return json(res, 200, { data: [{ id: "claude-sonnet-5-5", type: "model" }], has_more: false, first_id: null, last_id: null });
      if (req.url === "/v1/messages") {
        return json(res, 200, {
          id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: "end_turn", stop_sequence: null,
          content: [{ type: "text", text: '{"headlines":["a","b","c"]}' }], usage: { input_tokens: 3, output_tokens: 5 },
        });
      }
      json(res, 404, {});
    });
    try {
      const ai = new AnthropicAiProvider({ apiKey: "test-schluessel", baseURL: server.url });
      expect(await ai.health()).toEqual({ ok: true, detail: "Claude API erreichbar" });
      const out = await ai.complete({ functionKey: "headlines", model: "claude-sonnet-5-5", temperature: 0.4, system: "S", prompt: "P" });
      expect(out).toEqual({ text: '{"headlines":["a","b","c"]}', model: "claude-sonnet-5-5" });
      const sent = JSON.parse(server.requests.find((r) => r.url === "/v1/messages")!.body.toString()) as Record<string, unknown>;
      expect(sent).toMatchObject({ model: "claude-sonnet-5-5", system: "S", messages: [{ role: "user", content: "P" }] });
      expect(await new AnthropicAiProvider({ apiKey: "falsch", baseURL: server.url }).health()).toEqual({ ok: false, detail: "Claude API: Status 401" });
    } finally {
      await server.close();
    }
  });
});

describe("Web Push (Mock-Push-Dienst)", () => {
  /** Browser-Seite: Schlüsselpaar und Geheimnis wie bei PushManager.subscribe() */
  function browserKeys() {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    const auth = randomBytes(16);
    return { ecdh, auth, keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: auth.toString("base64url") } };
  }

  it("sendet verschlüsselt mit VAPID an alle Geräte und meldet abgelaufene Geräte", async () => {
    const tls = await selfSignedCert();
    const server = await mockServer((req, res) => {
      res.writeHead(req.url === "/abgelaufen" ? 410 : 201).end();
    }, { tls });
    try {
      const vapid = webpush.generateVAPIDKeys();
      const sender = new WebPushSender({ publicKey: vapid.publicKey, privateKey: vapid.privateKey, subject: "mailto:impress@example.com", agent: new Agent({ ca: tls.cert }) });
      expect(await sender.health()).toEqual({ ok: true, detail: "VAPID-Schlüssel gültig" });
      const phone = browserKeys();
      const laptop = browserKeys();
      const result = await sender.send(
        { userId: "u1", notificationId: "n1", title: "impress", body: "Covenant · PM · Frist 20.10.2026, 12:00", link: "/aufgaben/t1" },
        [
          { endpoint: `${server.url}/telefon`, keys: phone.keys },
          { endpoint: `${server.url}/abgelaufen`, keys: laptop.keys },
        ],
      );
      expect(result.expired).toEqual([`${server.url}/abgelaufen`]);
      const delivered = server.requests.find((r) => r.url === "/telefon")!;
      expect(delivered.headers["content-encoding"]).toBe("aes128gcm");
      expect(delivered.headers.authorization).toMatch(new RegExp(`^vapid t=.+, k=${vapid.publicKey}$`));
      expect(delivered.headers.ttl).toBe("86400");
      // Inhalt ist verschlüsselt; das Gerät entschlüsselt ihn mit seinem Schlüssel
      expect(delivered.body.toString()).not.toContain("Covenant");
      const ece = await import("http_ece");
      const plain = JSON.parse(ece.decrypt(delivered.body, { version: "aes128gcm", privateKey: phone.ecdh, authSecret: phone.keys.auth }).toString()) as Record<string, string>;
      expect(plain).toEqual({ title: "impress", body: "Covenant · PM · Frist 20.10.2026, 12:00", link: "/aufgaben/t1", tag: "n1" });
    } finally {
      await server.close();
    }
  });

  it("erkennt ungültige VAPID-Schlüssel", async () => {
    const sender = new WebPushSender({ publicKey: "kaputt", privateKey: "kaputt", subject: "mailto:impress@example.com" });
    expect((await sender.health()).ok).toBe(false);
  });
});
