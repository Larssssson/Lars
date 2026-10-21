import "server-only";
import { getAuthProvider } from "@/auth";
import { adapters } from "@/lib/adapters";
import { AdapterConfigError } from "@/lib/adapters/errors";
import type { HealthStatus } from "@/lib/adapters/health";
import { prisma } from "@/lib/db";

export type CheckName = "database" | "files" | "documents" | "ai" | "auth" | "push";
export type CheckResult = { name: CheckName; mode: "real" | "mock"; ok: boolean; detail: string };

const TIMEOUT_MS = 5_000;

async function withTimeout(run: () => Promise<HealthStatus>): Promise<HealthStatus> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<HealthStatus>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, detail: "Zeitüberschreitung" }), TIMEOUT_MS);
      }),
    ]);
  } catch {
    return { ok: false, detail: "Fehler bei der Prüfung" };
  } finally {
    clearTimeout(timer);
  }
}

async function database(): Promise<HealthStatus> {
  await prisma.$queryRaw`SELECT 1`;
  return { ok: true, detail: "PostgreSQL erreichbar" };
}

/**
 * Zustand aller Dienste (BRIEFING 16, 7.10). Die Texte nennen nie Schlüssel oder Adressen.
 * `names` begrenzt die Prüfung, etwa für /api/health auf Datenbank, Speicher, KI und SharePoint.
 */
export async function checkServices(names: CheckName[] = ["database", "files", "documents", "ai", "auth", "push"]): Promise<CheckResult[]> {
  const checks: Record<CheckName, () => { mode: "real" | "mock"; run: () => Promise<HealthStatus> }> = {
    database: () => ({ mode: "real", run: database }),
    files: () => {
      const a = adapters.fileStorage();
      return { mode: a.kind === "azure" ? "real" : "mock", run: () => a.health() };
    },
    documents: () => {
      const a = adapters.documentStore();
      return { mode: a.kind === "sharepoint" ? "real" : "mock", run: () => a.health() };
    },
    ai: () => {
      const a = adapters.ai();
      return { mode: a.kind === "anthropic" ? "real" : "mock", run: () => a.health() };
    },
    auth: () => ({ mode: getAuthProvider().kind === "entra" ? "real" : "mock", run: () => getAuthProvider().health() }),
    push: () => {
      const a = adapters.push();
      return { mode: a.kind === "webpush" ? "real" : "mock", run: () => a.health() };
    },
  };
  return Promise.all(
    names.map(async (name) => {
      try {
        const { mode, run } = checks[name]();
        const status = await withTimeout(run);
        return { name, mode, ok: status.ok, detail: status.detail ?? "" };
      } catch (error) {
        // fehlende Umgebungsvariablen beim Anlegen des Adapters: Namen nennen, nie Werte
        return { name, mode: "real" as const, ok: false, detail: error instanceof AdapterConfigError ? error.message : "Konfiguration ungültig" };
      }
    }),
  );
}
