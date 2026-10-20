import { t } from "@/i18n";

export class ForbiddenError extends Error {
  constructor(message: string = t.errors.forbidden) {
    super(message);
    this.name = "ForbiddenError";
  }
}
