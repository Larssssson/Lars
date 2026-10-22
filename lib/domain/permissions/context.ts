import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { PermissionContext } from "./index";

/** Zuordnungen und aktive Zusatzrechte eines Nutzers laden. */
export async function loadPermissionContext(db: PrismaClient, userId: string): Promise<PermissionContext> {
  const [memberships, grants] = await Promise.all([
    db.clientMember.findMany({ where: { userId }, select: { clientId: true, kind: true, canApprove: true } }),
    db.permissionGrant.findMany({
      where: { userId, revokedAt: null },
      select: { permission: true, clientId: true, revokedAt: true },
    }),
  ]);
  return { memberships, grants };
}
