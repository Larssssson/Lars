import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/** Für den Hinweis oben (DECISIONS D-128): neue, ungelesene Erwähnungen und Zuweisungen seit einem Zeitpunkt. */
const KINDS = ["MENTION", "TASK_ASSIGNED"];

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const now = new Date();
  const since = new Date(new URL(request.url).searchParams.get("seit") ?? "");
  if (Number.isNaN(since.getTime())) return NextResponse.json({ now: now.toISOString(), items: [] }, { headers: { "Cache-Control": "no-store" } });
  const items = await prisma.notification.findMany({
    where: { userId: user.id, kind: { in: KINDS }, readAt: null, createdAt: { gt: since, lte: now } },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true, kind: true, title: true, link: true },
  });
  return NextResponse.json({ now: now.toISOString(), items }, { headers: { "Cache-Control": "no-store" } });
}
