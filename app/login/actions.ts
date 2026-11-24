"use server";

import { AuthError } from "next-auth";
import { getAuthProvider, signIn } from "@/auth";
import { t } from "@/i18n";

export async function devLoginAction(formData: FormData) {
  if (getAuthProvider().kind !== "dev") throw new Error("Entwickler-Login ist abgeschaltet.");
  await signIn("dev", { userId: String(formData.get("userId") ?? ""), redirectTo: "/" });
}

export async function entraLoginAction() {
  await signIn(getAuthProvider().providerId, { redirectTo: "/" });
}

export type PasswordLoginState = { error?: string; name?: string };

/** Anmeldung mit Name und Passwort (DECISIONS D-125); Fehler ohne Hinweis, ob der Name existiert. */
export async function passwordLoginAction(_state: PasswordLoginState, formData: FormData): Promise<PasswordLoginState> {
  const name = String(formData.get("name") ?? "").slice(0, 120);
  if (getAuthProvider().kind !== "password") return { error: t.auth.password.failed, name };
  try {
    await signIn("password", { name, password: String(formData.get("password") ?? ""), redirectTo: "/" });
  } catch (error) {
    // Name bleibt im Feld stehen, das Passwort nicht
    if (error instanceof AuthError) return { error: t.auth.password.failed, name };
    throw error;
  }
  return {};
}
