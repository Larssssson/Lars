import { NextResponse } from "next/server";
import { z } from "zod";
import { buildMailDraft } from "@/lib/domain/documents/mail";
import { DomainError } from "@/lib/domain/errors";
import { serverDeps } from "@/lib/server/deps";
import { getCurrentUser } from "@/lib/session";

const query = z.object({
  art: z.enum(["docx", "pdf"]).default("docx"),
  vorlage: z.enum(["RP", "KUNDE"]).default("RP"),
  version: z.uuid().optional(),
  ton: z.enum(["freundlich", "nuechtern"]).default("freundlich"),
  laenge: z.enum(["kurz", "lang"]).default("kurz"),
});

/** Mail-Entwurf mit Anhang als .eml (DECISIONS D-129); Outlook öffnet ihn als neue Mail. */
export async function GET(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const taskId = z.uuid().safeParse((await params).taskId);
  const q = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!taskId.success || !q.success) return new NextResponse(null, { status: 400 });
  try {
    const mail = await buildMailDraft(serverDeps(), user, taskId.data, {
      kind: q.data.art,
      template: q.data.vorlage,
      versionId: q.data.version,
      tone: q.data.ton,
      length: q.data.laenge,
    });
    return new NextResponse(mail.eml, {
      headers: {
        "Content-Type": "message/rfc822",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(mail.fileName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof DomainError) return new NextResponse(error.message, { status: 409 });
    throw error;
  }
}
