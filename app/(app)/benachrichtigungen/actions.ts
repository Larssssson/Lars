"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { markAllRead, markRead } from "@/lib/domain/notifications";
import { runAction, type ActionState } from "@/lib/server/action";
import { requireUser } from "@/lib/session";

export async function markReadAction(id: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => markRead(prisma, await requireUser(), id, new Date()));
  revalidatePath("/", "layout");
  return result;
}

export async function markAllReadAction(_state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => markAllRead(prisma, await requireUser(), new Date()));
  revalidatePath("/", "layout");
  return result;
}
