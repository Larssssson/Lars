import { NextResponse } from "next/server";
import { z } from "zod";
import { releaseLock, saveContent } from "@/lib/domain/documents/service";
import { serverDeps } from "@/lib/server/deps";
import { getCurrentUser } from "@/lib/session";

/** Beim Schließen letzte Eingaben sichern und die Sperre lösen (navigator.sendBeacon, BRIEFING 7.3). */
export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const parsed = z.uuid().safeParse((await params).taskId);
  if (!parsed.success) return new NextResponse(null, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { content?: unknown };
  if (body.content) await saveContent(serverDeps(), user, parsed.data, body.content).catch(() => undefined);
  await releaseLock(serverDeps(), user, parsed.data).catch(() => undefined);
  return new NextResponse(null, { status: 204 });
}
