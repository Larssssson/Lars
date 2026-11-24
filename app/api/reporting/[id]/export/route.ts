import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { exportReport } from "@/lib/domain/reports/service";
import { serverDeps } from "@/lib/server/deps";
import { getCurrentUser } from "@/lib/session";

const query = z.object({ art: z.enum(["pdf", "docx", "pptx"]) });

/** Reporting als Word, PDF oder Executive-PowerPoint (DECISIONS D-133). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const q = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return new NextResponse(null, { status: 400 });
  try {
    const file = await exportReport(serverDeps(), user, (await params).id, q.data.art);
    return new NextResponse(Buffer.from(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) return new NextResponse(null, { status: 404 });
    if (error instanceof DomainError) return new NextResponse(error.message, { status: 409 });
    throw error;
  }
}
