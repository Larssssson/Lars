import { NextResponse } from "next/server";
import { z } from "zod";
import { documentState } from "@/lib/domain/documents/service";
import { serverDeps } from "@/lib/server/deps";
import { getCurrentUser } from "@/lib/session";

/** Zustand eines Dokuments zum Mitlesen (Inhalt, Sperre, Status), abgefragt alle paar Sekunden. */
export async function GET(_request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const parsed = z.uuid().safeParse((await params).taskId);
  if (!parsed.success) return new NextResponse(null, { status: 404 });
  try {
    return NextResponse.json(await documentState(serverDeps(), user, parsed.data), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
