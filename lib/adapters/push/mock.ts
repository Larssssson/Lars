import type { PushDevice, PushMessage, PushSender } from "./types";

/** Ersatz: Konsolenausgabe (ohne Inhalte) und Liste der gesendeten Nachrichten für Tests. */
export class MockPushSender implements PushSender {
  readonly kind = "mock" as const;
  readonly publicKey = null;
  readonly sent: (PushMessage & { devices: number })[] = [];

  async send(message: PushMessage, devices: PushDevice[]): Promise<{ expired: string[] }> {
    this.sent.push({ ...message, devices: devices.length });
    console.info(`[push:mock] an Nutzer ${message.userId}, Benachrichtigung ${message.notificationId}, ${devices.length} Gerät(e)`);
    return { expired: [] };
  }

  async health() {
    return { ok: true, detail: "Ersatz ohne Versand" };
  }
}
