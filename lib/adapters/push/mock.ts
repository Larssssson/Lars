import type { PushMessage, PushSender } from "./types";

/** Ersatz: Konsolenausgabe (ohne Inhalte) und Liste der gesendeten Nachrichten für Tests. */
export class MockPushSender implements PushSender {
  readonly kind = "mock" as const;
  readonly sent: PushMessage[] = [];

  async send(message: PushMessage): Promise<void> {
    this.sent.push(message);
    console.info(`[push:mock] an Nutzer ${message.userId}, Benachrichtigung ${message.notificationId}`);
  }

  async health() {
    return { ok: true, detail: "Ersatz ohne Versand" };
  }
}
