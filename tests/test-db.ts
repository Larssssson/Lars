import { execFileSync } from "node:child_process";
import pg from "pg";

/** Eigene Datenbanken für Tests, damit lokale Daten unberührt bleiben. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://impress:impress@localhost:5432/impress_test";
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://impress:impress@localhost:5432/impress_e2e";

/**
 * Testdatenbank anlegen bzw. leeren und alle Migrationen anwenden.
 * Aus Sicherheitsgründen nur für Datenbanken, deren Name auf _test oder _e2e endet.
 */
export async function resetDatabase(url: string): Promise<void> {
  const target = new URL(url);
  const name = target.pathname.slice(1);
  if (!/^[a-z0-9_]+_(test|e2e)$/.test(name)) {
    throw new Error(`Zurücksetzen nur für Testdatenbanken erlaubt, nicht für "${name}".`);
  }

  const admin = new URL(url);
  admin.pathname = "/postgres";
  const adminClient = new pg.Client({ connectionString: admin.toString() });
  await adminClient.connect();
  try {
    const exists = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (exists.rowCount === 0) await adminClient.query(`CREATE DATABASE "${name}"`);
  } finally {
    await adminClient.end();
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("DROP SCHEMA IF EXISTS pgboss CASCADE");
    await client.query("CREATE SCHEMA public");
  } finally {
    await client.end();
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
