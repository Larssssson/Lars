import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import type { AuthProvider } from "./types";

export type PasswordCheck = (name: string, password: string) => Promise<{ id: string; name: string; email: string } | null>;

/**
 * Anmeldung mit Vorname und Passwort für den Live-Test ohne Microsoft-Login (DECISIONS D-125).
 * Die Prüfung samt Sperre nach Fehlversuchen liegt in lib/domain/permissions/passwords.ts.
 */
export class PasswordAuthProvider implements AuthProvider {
  readonly kind = "password" as const;
  readonly providerId = "password";

  constructor(private readonly check: PasswordCheck) {}

  providers() {
    const check = this.check;
    return [
      Credentials({
        id: "password",
        name: "Passwort",
        credentials: { name: { type: "text" }, password: { type: "password" } },
        async authorize(credentials) {
          const parsed = z.object({ name: z.string().trim().min(1).max(120), password: z.string().min(1).max(200) }).safeParse(credentials);
          if (!parsed.success) return null;
          return check(parsed.data.name, parsed.data.password);
        },
      }),
    ];
  }

  async health() {
    return { ok: true, detail: "Anmeldung mit Passwort" };
  }
}
