import type { Provider } from "next-auth/providers";

/**
 * Login-Anbindung (BRIEFING 10.2). Beide Varianten liefern Auth.js-Provider;
 * die Zuordnung zum angelegten Nutzer erfolgt immer über die Mailadresse.
 */
export interface AuthProvider {
  readonly kind: "dev" | "entra";
  /** Auth.js-Provider-ID, die signIn() übergeben wird */
  readonly providerId: string;
  providers(): Provider[];
}
