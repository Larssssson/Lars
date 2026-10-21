import { DomainError } from "@/lib/domain/errors";

/** "KI erlaubt" ist für den Kunden aus (BRIEFING 7.7, 8.3 Regel 7). */
export class AiNotAllowedError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "AiNotAllowedError";
  }
}

/** Claude API nicht erreichbar; impress arbeitet ohne KI weiter (BRIEFING 8.3 Regel 9). */
export class AiUnavailableError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/** Auch nach einem zweiten Versuch keine gültige Ausgabe (BRIEFING 8.3 Regel 2). */
export class AiOutputError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "AiOutputError";
  }
}
