import "server-only";
import { adapters } from "@/lib/adapters";
import { prisma } from "@/lib/db";
import type { Deps } from "@/lib/domain/deps";

export function serverDeps(): Deps {
  return { db: prisma, push: adapters.push(), files: adapters.fileStorage(), now: () => new Date() };
}
