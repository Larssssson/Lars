import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * Aktueller Nutzer. Bei jeder Anfrage wird active geprüft, damit gesperrte Nutzer
 * sofort den Zugang verlieren, auch in laufenden Sitzungen (BRIEFING 11, DECISIONS D-029).
 */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  const userId = (session as { userId?: string } | null)?.userId;
  if (!userId) return null;
  return prisma.user.findFirst({ where: { id: userId, active: true } });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
