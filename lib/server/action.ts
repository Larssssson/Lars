import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { t } from "@/i18n";
import { DomainError } from "@/lib/domain/errors";
import { ForbiddenError } from "@/lib/domain/permissions";

export type ActionState = { error?: string; ok?: string } | undefined;

/**
 * Server Action ausführen und fachliche Fehler als Meldung zurückgeben.
 * Unerwartete Fehler werden ohne Inhalte protokolliert und allgemein gemeldet.
 */
export async function runAction(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const ok = await fn();
    return ok ? { ok } : {};
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ZodError) return { error: error.issues[0]?.message ?? t.errors.invalidInput };
    if (error instanceof DomainError && error.name === "CheckConfirmationRequired") throw error;
    if (error instanceof DomainError || error instanceof ForbiddenError) return { error: error.message };
    console.error("[action] unerwarteter Fehler:", error instanceof Error ? error.name : "unbekannt");
    return { error: t.errors.unexpected };
  }
}

export function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export function bool(form: FormData, key: string): boolean {
  const v = form.get(key);
  return v === "on" || v === "true" || v === "1";
}
