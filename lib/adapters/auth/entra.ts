import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { requireVars } from "../errors";
import type { AuthProvider } from "./types";

/** Microsoft Entra ID der RP. Zuordnung zum Nutzer über die Mailadresse (BRIEFING 3.4). */
export class EntraAuthProvider implements AuthProvider {
  readonly kind = "entra" as const;
  readonly providerId = "microsoft-entra-id";
  private readonly config: Record<string, string>;

  constructor(config: { clientId?: string; clientSecret?: string; tenantId?: string }) {
    this.config = requireVars("Entra ID", {
      ENTRA_CLIENT_ID: config.clientId,
      ENTRA_CLIENT_SECRET: config.clientSecret,
      ENTRA_TENANT_ID: config.tenantId,
    });
  }

  providers() {
    return [
      MicrosoftEntraID({
        clientId: this.config.ENTRA_CLIENT_ID,
        clientSecret: this.config.ENTRA_CLIENT_SECRET,
        issuer: `https://login.microsoftonline.com/${this.config.ENTRA_TENANT_ID}/v2.0`,
      }),
    ];
  }
}
