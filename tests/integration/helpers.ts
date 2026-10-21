import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MockAiProvider } from "@/lib/adapters/ai/mock";
import { MockDocumentStore } from "@/lib/adapters/document-store/mock";
import { LocalFileStorage } from "@/lib/adapters/file-storage/local";
import { MockPushSender } from "@/lib/adapters/push/mock";
import type { Deps } from "@/lib/domain/deps";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { atTime } from "@/lib/time";
import { seed } from "@/prisma/seed";

/** Dienstag, 20.10.2026, 10:00 Uhr in Berlin: feste Uhr für alle Integrationstests. */
export const FIXED_NOW = atTime("2026-10-20", "10:00");

/** Alle Tabellen leeren (TRUNCATE umgeht den Löschschutz des Protokolls) und neu seeden. */
export async function resetAndSeed(db: PrismaClient, now: Date = FIXED_NOW): Promise<void> {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await seed(db, now);
}

export type TestDeps = Deps & { push: MockPushSender; clock: { now: Date }; storageDir: string };

export async function testDeps(db: PrismaClient, now: Date = FIXED_NOW): Promise<TestDeps> {
  const clock = { now };
  const dir = await mkdtemp(path.join(os.tmpdir(), "impress-files-"));
  return {
    db,
    push: new MockPushSender(),
    files: new LocalFileStorage(path.join(dir, "files")),
    documents: new MockDocumentStore(path.join(dir, "sharepoint-mock"), "impress/Kunden"),
    ai: new MockAiProvider(path.resolve("fixtures/ai")),
    now: () => clock.now,
    clock,
    storageDir: dir,
  };
}

export async function userByKey(db: PrismaClient, key: string) {
  return db.user.findUniqueOrThrow({ where: { email: `${key}@example.com` } });
}

export async function clientByName(db: PrismaClient, name: string) {
  return db.client.findUniqueOrThrow({ where: { shortName: name } });
}

type User = Awaited<ReturnType<typeof userByKey>>;

/** Mehrere Seed-Nutzer auf einmal, als Tupel typisiert. */
export async function usersByKey<const K extends readonly string[]>(db: PrismaClient, keys: K): Promise<{ [I in keyof K]: User }> {
  return (await Promise.all(keys.map((k) => userByKey(db, k)))) as { [I in keyof K]: User };
}

export async function clientsByName<const K extends readonly string[]>(
  db: PrismaClient,
  names: K,
): Promise<{ [I in keyof K]: Awaited<ReturnType<typeof clientByName>> }> {
  return (await Promise.all(names.map((n) => clientByName(db, n)))) as { [I in keyof K]: Awaited<ReturnType<typeof clientByName>> };
}
