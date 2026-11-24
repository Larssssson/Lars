import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/domain/errors";
import { reportPreview } from "@/lib/domain/reports/service";
import { serverDeps } from "@/lib/server/deps";
import { getCurrentUser } from "@/lib/session";

/** Vorschau als HTML (gleiche Darstellung wie das PDF), im iframe der Reporting-Seite. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  try {
    const { html } = await reportPreview(serverDeps(), (await params).id);
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'self'", "X-Frame-Options": "SAMEORIGIN" } });
  } catch (error) {
    if (error instanceof NotFoundError) return new NextResponse(null, { status: 404 });
    throw error;
  }
}
