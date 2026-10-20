import "dotenv/config";
import { PgBoss } from "pg-boss";
import { env } from "../lib/env";
import { jobs } from "./index";

/** Eigener Worker-Prozess für pg-boss (DECISIONS D-030). Start: npm run worker */
async function main() {
  const boss = new PgBoss(env().DATABASE_URL);
  boss.on("error", (error) => console.error("[worker] Fehler:", error.message));
  await boss.start();

  for (const job of jobs) {
    await boss.createQueue(job.name);
    await boss.work(job.name, async () => job.handler());
    if (job.cron) await boss.schedule(job.name, job.cron, null, { tz: "Europe/Berlin" });
  }
  console.info(`[worker] bereit, ${jobs.length} Jobs registriert.`);

  const stop = async () => {
    await boss.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error: unknown) => {
  console.error("[worker] Start fehlgeschlagen:", error instanceof Error ? error.message : error);
  process.exit(1);
});
