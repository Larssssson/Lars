import { AdapterNotReadyError, requireVars } from "../errors";
import type { PushSender } from "./types";

/** Echter Versand über Web Push (VAPID). Implementierung in Phase 6. */
export class WebPushSender implements PushSender {
  readonly kind = "webpush" as const;

  constructor(config: { publicKey?: string; privateKey?: string; subject?: string }) {
    requireVars("Web Push", {
      VAPID_PUBLIC_KEY: config.publicKey,
      VAPID_PRIVATE_KEY: config.privateKey,
      VAPID_SUBJECT: config.subject,
    });
  }

  async send(): Promise<void> {
    throw new AdapterNotReadyError("Web Push");
  }

  async health() {
    return { ok: false, detail: "noch nicht implementiert" };
  }
}
