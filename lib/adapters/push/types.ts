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

/** Ein registriertes Gerät (Push-Abonnement des Browsers). */
export type PushDevice = { endpoint: string; keys: { p256dh: string; auth: string } };

/**
 * Versand von Push-Nachrichten. Der Eintrag in der Benachrichtigungstabelle
 * (isPush = true) entsteht immer im Benachrichtigungsdienst, der Adapter versendet nur
 * an die übergebenen Geräte und meldet Geräte zurück, die der Push-Dienst nicht mehr kennt.
 */
export interface PushSender {
  readonly kind: "mock" | "webpush";
  /** öffentlicher VAPID-Schlüssel für das Abonnement im Browser (Ersatz: null) */
  readonly publicKey: string | null;
  send(message: PushMessage, devices: PushDevice[]): Promise<{ expired: string[] }>;
  health(): Promise<HealthStatus>;
}
