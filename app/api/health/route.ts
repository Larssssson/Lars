import { checkServices } from "@/lib/server/health";

export const dynamic = "force-dynamic";

/**
 * Gesundheitsendpunkt für den Betrieb (BRIEFING 16): Datenbank, Speicher, KI, SharePoint.
 * Ohne Anmeldung erreichbar, ohne Inhalte. 503 nur, wenn die Datenbank fehlt; Störungen der
 * übrigen Dienste meldet "status": "degraded" (DECISIONS D-112).
 */
export async function GET() {
  const results = await checkServices(["database", "files", "ai", "documents"]);
  const label = { database: "datenbank", files: "speicher", ai: "ki", documents: "sharepoint" } as Record<string, string>;
  const checks = Object.fromEntries(results.map((r) => [label[r.name], { ok: r.ok, mode: r.mode, detail: r.detail }]));
  const dbOk = results.find((r) => r.name === "database")?.ok ?? false;
  const status = !dbOk ? "error" : results.every((r) => r.ok) ? "ok" : "degraded";
  return Response.json({ status, checks }, { status: dbOk ? 200 : 503, headers: { "cache-control": "no-store" } });
}
