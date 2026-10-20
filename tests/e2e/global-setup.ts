import { E2E_DATABASE_URL, resetDatabase } from "../test-db";

export default async function globalSetup() {
  await resetDatabase(E2E_DATABASE_URL);
  process.env.DATABASE_URL = E2E_DATABASE_URL;
  const { createPrismaClient } = await import("../../lib/db");
  const { seed } = await import("../../prisma/seed");
  const db = createPrismaClient(E2E_DATABASE_URL);
  try {
    await seed(db);
  } finally {
    await db.$disconnect();
  }
}
