import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer as createHttpsServer } from "node:https";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

export type Recorded = { method: string; url: string; headers: IncomingMessage["headers"]; body: Buffer };

/** Kleiner HTTP-Mock-Server: zeichnet jede Anfrage auf, die Antwort bestimmt der Handler. */
export async function mockServer(handler: (req: Recorded, res: ServerResponse) => void | Promise<void>, options: { tls?: { key: string; cert: string } } = {}) {
  const requests: Recorded[] = [];
  const listener = (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", async () => {
      const recorded = { method: req.method ?? "GET", url: req.url ?? "/", headers: req.headers, body: Buffer.concat(chunks) };
      requests.push(recorded);
      try {
        await handler(recorded, res);
      } catch {
        res.writeHead(500).end();
      }
    });
  };
  const server: Server = options.tls ? createHttpsServer(options.tls, listener) : createServer(listener);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as net.AddressInfo;
  return { url: `${options.tls ? "https" : "http"}://127.0.0.1:${port}`, requests, close: () => new Promise<void>((r) => server.close(() => r())) };
}

/** Selbst signiertes Zertifikat für 127.0.0.1 (nur Tests). */
export async function selfSignedCert(): Promise<{ key: string; cert: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "impress-tls-"));
  try {
    execFileSync("openssl", ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1", "-keyout", path.join(dir, "key.pem"), "-out", path.join(dir, "cert.pem")], { stdio: "ignore" });
    return { key: readFileSync(path.join(dir, "key.pem"), "utf8"), cert: readFileSync(path.join(dir, "cert.pem"), "utf8") };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

/** Bekannter, öffentlicher Entwicklungsschlüssel von Azurite (kein Geheimnis). */
const AZURITE_KEY = "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";

/** Azurite (offizieller Azure-Storage-Emulator) als Testumgebung für Azure Blob. */
export async function startAzurite(): Promise<{ connectionString: string; stop: () => Promise<void> }> {
  const port = await freePort();
  const dir = await mkdtemp(path.join(os.tmpdir(), "impress-azurite-"));
  const bin = path.resolve("node_modules/.bin/azurite-blob");
  const child: ChildProcess = spawn(bin, ["--blobHost", "127.0.0.1", "--blobPort", String(port), "--location", dir, "--silent", "--skipApiVersionCheck"], { stdio: "ignore" });
  const deadline = Date.now() + 20_000;
  for (;;) {
    const open = await new Promise<boolean>((resolve) => {
      const socket = net.connect(port, "127.0.0.1", () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
    });
    if (open) break;
    if (Date.now() > deadline) throw new Error("Azurite startet nicht");
    await new Promise((r) => setTimeout(r, 200));
  }
  return {
    connectionString: `DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=${AZURITE_KEY};BlobEndpoint=http://127.0.0.1:${port}/devstoreaccount1;`,
    stop: async () => {
      child.kill();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
