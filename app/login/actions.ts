"use server";

import { authProvider, signIn } from "@/auth";

export async function devLoginAction(formData: FormData) {
  if (authProvider.kind !== "dev") throw new Error("Entwickler-Login ist abgeschaltet.");
  await signIn("dev", { userId: String(formData.get("userId") ?? ""), redirectTo: "/" });
}

export async function entraLoginAction() {
  await signIn(authProvider.providerId, { redirectTo: "/" });
}
