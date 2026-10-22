import { NextResponse } from "next/server";
import { z } from "zod";
import { exportDocument } from "@/lib/domain/documents/dispatch";
import { DomainError } from "@/lib/domain/errors";
import { serverDeps } from "@/lib/server/deps";
import { getCurrentUser } from "@/lib/session";

const query = z.object({
  art: z.enum(["docx", "pdf"]).default("docx"),
  vorlage: z.enum(["RP", "KUNDE"]).default("RP"),
  version: z.uuid().optional(),
});

/** Export als Word oder PDF, saubere Fassung (BRIEFING 7.3, 6.5). */
export async function GET(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const taskId = z.uuid().safeParse((await params).taskId);
  const q = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!taskId.success || !q.success) return new NextResponse(null, { status: 400 });
  try {
    const file = await exportDocument(serverDeps(), user, taskId.data, { kind: q.data.art, template: q.data.vorlage, versionId: q.data.version });
    return new NextResponse(Buffer.from(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof DomainError) return new NextResponse(error.message, { status: 409 });
    throw error;
  }
}
