import { E2E_DATABASE_URL, resetDatabase } from "../test-db";

export default async function globalSetup() {
  await resetDatabase(E2E_DATABASE_URL);
  process.env.DATABASE_URL = E2E_DATABASE_URL;
  const { createPrismaClient } = await import("../../lib/db");
  const { seed } = await import("../../prisma/seed");
  const { MockDocumentStore } = await import("../../lib/adapters/document-store/mock");
  const { LocalFileStorage } = await import("../../lib/adapters/file-storage/local");
  const { rm } = await import("node:fs/promises");
  await rm("storage/e2e", { recursive: true, force: true });
  const db = createPrismaClient(E2E_DATABASE_URL);
  try {
    await seed(db, new Date(), {
      files: new LocalFileStorage("storage/e2e/files"),
      documents: new MockDocumentStore("storage/e2e/sharepoint-mock", "impress/Kunden"),
    });
  } finally {
    await db.$disconnect();
  }
}
