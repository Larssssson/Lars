import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { requireVars } from "../errors";
import type { AuthProvider } from "./types";

type EntraClaims = { sub?: string; name?: string; email?: string; preferred_username?: string };

/**
 * Profil aus dem ID-Token: Name und Mailadresse, sonst nichts (Grundsatz 9). Ohne Mail-Attribut
 * gilt der Anmeldename (UPN), der bei RP der Mailadresse entspricht (DECISIONS D-111).
 */
export function entraProfile(claims: EntraClaims) {
  return { id: claims.sub ?? "", name: claims.name ?? null, email: (claims.email ?? claims.preferred_username ?? "").toLowerCase() || null, image: null };
}

/** Microsoft Entra ID der RP, nur der eigene Mandant. Zuordnung zum Nutzer über die Mailadresse (BRIEFING 3.4). */
export class EntraAuthProvider implements AuthProvider {
  readonly kind = "entra" as const;
  readonly providerId = "microsoft-entra-id";
  private readonly config: Record<string, string>;
  private readonly loginBaseUrl: string;
  private readonly http: typeof fetch;

  constructor(config: { clientId?: string; clientSecret?: string; tenantId?: string; loginBaseUrl?: string; fetch?: typeof fetch }) {
    this.config = requireVars("Entra ID", {
      ENTRA_CLIENT_ID: config.clientId,
      ENTRA_CLIENT_SECRET: config.clientSecret,
      ENTRA_TENANT_ID: config.tenantId,
    });
    this.loginBaseUrl = (config.loginBaseUrl ?? "https://login.microsoftonline.com").replace(/\/$/, "");
    this.http = config.fetch ?? fetch;
  }

  get issuer(): string {
    return `${this.loginBaseUrl}/${this.config.ENTRA_TENANT_ID}/v2.0`;
  }

  providers() {
    return [
      MicrosoftEntraID({
        clientId: this.config.ENTRA_CLIENT_ID,
        clientSecret: this.config.ENTRA_CLIENT_SECRET,
        issuer: this.issuer,
        // ohne User.Read: impress liest kein Profilbild und nichts aus dem Postfach
        authorization: { params: { scope: "openid profile email" } },
        profile: (claims) => entraProfile(claims as EntraClaims),
      }),
    ];
  }

  /** Erreichbarkeit des Mandanten (OpenID-Konfiguration), ohne Anmeldung. */
  async health() {
    try {
      const response = await this.http(`${this.issuer}/.well-known/openid-configuration`);
      if (!response.ok) return { ok: false, detail: `Entra ID: Status ${response.status}` };
      const body = (await response.json()) as { issuer?: string };
      return body.issuer ? { ok: true, detail: "Entra ID erreichbar" } : { ok: false, detail: "Entra ID: unerwartete Antwort" };
    } catch {
      return { ok: false, detail: "Entra ID nicht erreichbar" };
    }
  }
}
