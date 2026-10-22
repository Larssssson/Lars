"use server";

import { getAuthProvider, signIn } from "@/auth";

export async function devLoginAction(formData: FormData) {
  if (getAuthProvider().kind !== "dev") throw new Error("Entwickler-Login ist abgeschaltet.");
  await signIn("dev", { userId: String(formData.get("userId") ?? ""), redirectTo: "/" });
}

export async function entraLoginAction() {
  await signIn(getAuthProvider().providerId, { redirectTo: "/" });
}
