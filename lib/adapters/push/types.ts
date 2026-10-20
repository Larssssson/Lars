import type { HealthStatus } from "../health";

export type PushMessage = {
  userId: string;
  /** Benachrichtigung in der Glocke, zu der diese Push-Nachricht gehört */
  notificationId: string;
  title: string;
  body: string;
  /** öffnet beim Antippen die Aufgabe */
  link: string;
};

/**
 * Versand von Push-Nachrichten. Der Eintrag in der Benachrichtigungstabelle
 * (isPush = true) entsteht immer im Benachrichtigungsdienst, der Adapter versendet nur.
 */
export interface PushSender {
  readonly kind: "mock" | "webpush";
  send(message: PushMessage): Promise<void>;
  health(): Promise<HealthStatus>;
}
