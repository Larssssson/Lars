import { z } from "zod";

/**
 * Umgebungsvariablen nach BRIEFING 10.4. Mit den Standardwerten startet impress
 * ohne Zugangsdaten (alle Adapter auf Ersatz, Entwickler-Login).
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_PROVIDER: z.enum(["dev", "entra"]).default("dev"),
  ENTRA_CLIENT_ID: z.string().optional(),
  ENTRA_CLIENT_SECRET: z.string().optional(),
  ENTRA_TENANT_ID: z.string().optional(),
  DOCUMENT_STORE: z.enum(["mock", "sharepoint"]).default("mock"),
  SHAREPOINT_SITE_ID: z.string().optional(),
  SHAREPOINT_DRIVE_ID: z.string().optional(),
  SHAREPOINT_ROOT_PATH: z.string().default("impress/Kunden"),
  FILE_STORAGE: z.enum(["local", "azure"]).default("local"),
  AZURE_STORAGE_CONNECTION_STRING: z.string().optional(),
  AZURE_STORAGE_CONTAINER: z.string().optional(),
  AI_PROVIDER: z.enum(["mock", "anthropic"]).default("mock"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL_QUALITY: z.string().default("claude-sonnet-5-5"),
  AI_MODEL_FAST: z.string().default("claude-haiku-5-5"),
  PUSH_PROVIDER: z.enum(["mock", "webpush"]).default("mock"),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  MONITORING_SOURCE: z.enum(["file", "sample"]).default("file"),
  APP_BASE_URL: z.string().default("http://localhost:3000"),
  STORAGE_DIR: z.string().default("./storage"),
});

export type Env = z.infer<typeof schema>;

/** Leere Strings aus .env gelten als nicht gesetzt. */
function clean(source: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== ""),
  );
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const env = schema.parse(clean(source));
  if (env.NODE_ENV === "production" && env.AUTH_PROVIDER === "dev") {
    // DECISIONS D-028: Entwickler-Login ist im Betrieb ausgeschlossen.
    throw new Error("AUTH_PROVIDER=dev ist bei NODE_ENV=production nicht erlaubt.");
  }
  return env;
}

let cached: Env | undefined;

export function env(): Env {
  cached ??= readEnv();
  return cached;
}
