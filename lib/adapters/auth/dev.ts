import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import type { AuthProvider } from "./types";

export type DevUserLookup = (userId: string) => Promise<{ id: string; name: string; email: string } | null>;

/** Ersatz: Entwickler-Login mit Auswahl der Seed-Nutzer, nie im Betrieb (DECISIONS D-028). */
export class DevAuthProvider implements AuthProvider {
  readonly kind = "dev" as const;
  readonly providerId = "dev";

  constructor(private readonly lookup: DevUserLookup) {}

  providers() {
    const lookup = this.lookup;
    return [
      Credentials({
        id: "dev",
        name: "Entwickler-Login",
        credentials: { userId: { type: "text" } },
        async authorize(credentials) {
          const parsed = z.object({ userId: z.uuid() }).safeParse(credentials);
          if (!parsed.success) return null;
          return lookup(parsed.data.userId);
        },
      }),
    ];
  }
}
