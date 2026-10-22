import type { Agent } from "node:https";
import webpush, { WebPushError } from "web-push";
import { requireVars } from "../errors";
import type { PushDevice, PushMessage, PushSender } from "./types";

/** Nachricht verfällt nach einem Tag, wenn das Gerät so lange nicht erreichbar ist. */
const TTL_SECONDS = 24 * 60 * 60;

/**
 * Echter Versand über Web Push mit VAPID (BRIEFING 10.3). Die Nutzlast ist verschlüsselt
 * (aes128gcm) und enthält nur Titel, Text, Link und die ID der Benachrichtigung.
 */
export class WebPushSender implements PushSender {
  readonly kind = "webpush" as const;
  readonly publicKey: string;
  private readonly vapid: { subject: string; publicKey: string; privateKey: string };
  private readonly agent?: Agent;

  /** agent nur für Tests (Mock-Push-Dienst mit eigenem Zertifikat) */
  constructor(config: { publicKey?: string; privateKey?: string; subject?: string; agent?: Agent }) {
    const vars = requireVars("Web Push", {
      VAPID_PUBLIC_KEY: config.publicKey,
      VAPID_PRIVATE_KEY: config.privateKey,
      VAPID_SUBJECT: config.subject,
    });
    this.vapid = { subject: vars.VAPID_SUBJECT!, publicKey: vars.VAPID_PUBLIC_KEY!, privateKey: vars.VAPID_PRIVATE_KEY! };
    this.publicKey = this.vapid.publicKey;
    this.agent = config.agent;
  }

  async send(message: PushMessage, devices: PushDevice[]): Promise<{ expired: string[] }> {
    const payload = JSON.stringify({ title: message.title, body: message.body, link: message.link, tag: message.notificationId });
    const expired: string[] = [];
    await Promise.all(
      devices.map(async (device) => {
        try {
          await webpush.sendNotification(device, payload, {
            vapidDetails: this.vapid,
            TTL: TTL_SECONDS,
            urgency: "high",
            contentEncoding: "aes128gcm",
            ...(this.agent ? { agent: this.agent } : {}),
          });
        } catch (error) {
          // 404 und 410: das Abonnement gibt es nicht mehr, das Gerät wird entfernt
          if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) expired.push(device.endpoint);
          else console.warn(`[push:webpush] Versand fehlgeschlagen: ${error instanceof WebPushError ? `Status ${error.statusCode}` : "Netzwerkfehler"}`);
        }
      }),
    );
    return { expired };
  }

  async health() {
    try {
      // prüft Form und Länge der Schlüssel, ohne etwas zu senden
      webpush.getVapidHeaders("https://push.example.invalid", this.vapid.subject, this.vapid.publicKey, this.vapid.privateKey, "aes128gcm");
      return { ok: true, detail: "VAPID-Schlüssel gültig" };
    } catch {
      return { ok: false, detail: "VAPID-Schlüssel ungültig" };
    }
  }
}
