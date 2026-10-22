"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { setSelectedClient } from "@/lib/domain/clients/selection";
import { requireUser } from "@/lib/session";

export async function selectClientAction(formData: FormData) {
  const user = await requireUser();
  const raw = String(formData.get("clientId") ?? "");
  const clientId = raw === "" ? null : z.uuid().parse(raw);
  await setSelectedClient(prisma, user, clientId);
  revalidatePath("/", "layout");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
