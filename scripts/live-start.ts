/**
 * Start im Live-Test (DECISIONS D-131): Konfiguration einspielen, einmalig alles leeren (IMPRESS_LIVE_RESET=true)
 * und Startpasswörter setzen (INITIAL_PASSWORD_HASHES). Gibt nur Zahlen aus, keine Namen oder Inhalte.
 */
import "dotenv/config";
import { createPrismaClient } from "../lib/db";
import { applyInitialPasswords, liveResetOnce } from "../prisma/live-reset";
import { seed } from "../prisma/seed";

const db = createPrismaClient();
try {
  if (process.env.IMPRESS_LIVE_RESET === "true") {
    const result = await liveResetOnce(db);
    console.info(result ? `impress-live: Inhalte geleert (${Object.values(result).reduce((a, b) => a + b, 0)} Datensätze).` : "impress-live: schon geleert, nichts gelöscht.");
  }
  await seed(db, new Date(), {}, { samples: false });
  const set = await applyInitialPasswords(db, process.env.INITIAL_PASSWORD_HASHES);
  console.info(`impress-live: Konfiguration bereit, ${set} Startpasswörter gesetzt.`);
} finally {
  await db.$disconnect();
}
