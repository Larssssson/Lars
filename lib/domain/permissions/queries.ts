import type { PrismaClient } from "@/lib/generated/prisma/client";
import { hasApprovalRight } from "./index";

/** Alle aktiven Nutzer mit Freigaberecht für den Kunden (BRIEFING 3.3, 6.4). */
export async function approversForClient(db: PrismaClient, clientId: string) {
  const users = await db.user.findMany({
    where: { active: true },
    include: {
      clientMembers: { select: { clientId: true, kind: true, canApprove: true } },
      permissionGrants: { where: { revokedAt: null }, select: { permission: true, clientId: true, revokedAt: true } },
    },
    orderBy: { name: "asc" },
  });
  return users
    .filter((u) => hasApprovalRight(u, { memberships: u.clientMembers, grants: u.permissionGrants }, clientId))
    .map((u) => ({ id: u.id, name: u.name }));
}
