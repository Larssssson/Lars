import path from "node:path";
import { env, type Env } from "@/lib/env";
import { AnthropicAiProvider } from "./ai/anthropic";
import { MockAiProvider } from "./ai/mock";
import type { AiProvider } from "./ai/types";
import { DevAuthProvider, type DevUserLookup } from "./auth/dev";
import { EntraAuthProvider } from "./auth/entra";
import type { AuthProvider } from "./auth/types";
import { MockDocumentStore } from "./document-store/mock";
import { SharePointDocumentStore } from "./document-store/sharepoint";
import type { DocumentStore } from "./document-store/types";
import { AzureBlobFileStorage } from "./file-storage/azure";
import { LocalFileStorage } from "./file-storage/local";
import type { FileStorage } from "./file-storage/types";
import { FileMonitoringSource, SampleMonitoringSource } from "./monitoring/file";
import type { MonitoringSource } from "./monitoring/types";
import { MockPushSender } from "./push/mock";
import { WebPushSender } from "./push/webpush";
import type { PushSender } from "./push/types";

export type { AiProvider, AuthProvider, DocumentStore, FileStorage, MonitoringSource, PushSender };

/**
 * Auswahl der Adapter per Umgebungsvariable (BRIEFING 10.2, 10.4).
 * Die create*-Funktionen nehmen die Umgebung als Parameter, damit Tests umschalten können.
 */
export function createAuthProvider(e: Env, lookup: DevUserLookup): AuthProvider {
  return e.AUTH_PROVIDER === "entra"
    ? new EntraAuthProvider({ clientId: e.ENTRA_CLIENT_ID, clientSecret: e.ENTRA_CLIENT_SECRET, tenantId: e.ENTRA_TENANT_ID })
    : new DevAuthProvider(lookup);
}

export function createDocumentStore(e: Env): DocumentStore {
  return e.DOCUMENT_STORE === "sharepoint"
    ? new SharePointDocumentStore({ siteId: e.SHAREPOINT_SITE_ID, driveId: e.SHAREPOINT_DRIVE_ID, rootPath: e.SHAREPOINT_ROOT_PATH })
    : new MockDocumentStore(path.join(e.STORAGE_DIR, "sharepoint-mock"), e.SHAREPOINT_ROOT_PATH);
}

export function createFileStorage(e: Env): FileStorage {
  return e.FILE_STORAGE === "azure"
    ? new AzureBlobFileStorage({ connectionString: e.AZURE_STORAGE_CONNECTION_STRING, container: e.AZURE_STORAGE_CONTAINER })
    : new LocalFileStorage(path.join(e.STORAGE_DIR, "files"));
}

export function createAiProvider(e: Env): AiProvider {
  return e.AI_PROVIDER === "anthropic"
    ? new AnthropicAiProvider({ apiKey: e.ANTHROPIC_API_KEY })
    : new MockAiProvider(path.resolve("fixtures/ai"));
}

export function createPushSender(e: Env): PushSender {
  return e.PUSH_PROVIDER === "webpush"
    ? new WebPushSender({ publicKey: e.VAPID_PUBLIC_KEY, privateKey: e.VAPID_PRIVATE_KEY, subject: e.VAPID_SUBJECT })
    : new MockPushSender();
}

export function createMonitoringSource(e: Env): MonitoringSource {
  return e.MONITORING_SOURCE === "sample"
    ? new SampleMonitoringSource(path.resolve("fixtures/monitoring/meltwater_sample.csv"))
    : new FileMonitoringSource();
}

const cache = new Map<string, unknown>();

function once<T>(key: string, factory: () => T): T {
  if (!cache.has(key)) cache.set(key, factory());
  return cache.get(key) as T;
}

export const adapters = {
  documentStore: () => once("documentStore", () => createDocumentStore(env())),
  fileStorage: () => once("fileStorage", () => createFileStorage(env())),
  ai: () => once("ai", () => createAiProvider(env())),
  push: () => once("push", () => createPushSender(env())),
  monitoring: () => once("monitoring", () => createMonitoringSource(env())),
};
