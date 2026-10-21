import "server-only";
import { prisma } from "@/lib/db";
import { loadProfile } from "@/lib/domain/clients/profile";
import { servicesWithProgress } from "@/lib/domain/clients/services";
import type { NamedActor } from "@/lib/domain/permissions";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import type { ProfileContext } from "./profile-view";

/** Alles, was Profilseite und Onboarding brauchen. */
export async function loadProfileContext(clientId: string, user: NamedActor): Promise<ProfileContext | null> {
  const now = new Date();
  const profile = await loadProfile(prisma, clientId).catch(() => null);
  if (!profile || profile.client.isInternal) return null;
  const [services, ctx, users, members] = await Promise.all([
    servicesWithProgress(prisma, clientId, now),
    loadPermissionContext(prisma, user.id),
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.clientMember.findMany({ where: { clientId }, include: { user: { select: { name: true } } } }),
  ]);
  return {
    profile,
    services,
    user,
    ctx,
    names: new Map(users.map((u) => [u.id, u.name])),
    members: members.map((m) => ({ name: m.user.name, kind: m.kind })),
    now,
  };
}
