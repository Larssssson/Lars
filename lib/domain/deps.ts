import type { DocumentStore, FileStorage, PushSender } from "@/lib/adapters";
import type { PrismaClient } from "@/lib/generated/prisma/client";

/** Abhängigkeiten der Fachlogik; Tests setzen eigene Uhr und Ersatz-Adapter ein. */
export type Deps = {
  db: PrismaClient;
  push: PushSender;
  files: FileStorage;
  documents: DocumentStore;
  now: () => Date;
};
