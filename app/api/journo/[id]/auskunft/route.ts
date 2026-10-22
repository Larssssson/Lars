import { NextResponse } from "next/server";
import { exportContactData, exportContactPdf } from "@/lib/domain/journo/privacy";
import { DomainError } from "@/lib/domain/errors";
import { ForbiddenError } from "@/lib/domain/permissions";
import { serverDeps } from "@/lib/server/deps";
import { getCurrentUser } from "@/lib/session";

/** Auskunft zu einem Kontakt als JSON oder PDF, nur CVD (BRIEFING 11); die Prüfung liegt in der Fachlogik. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "json";
  try {
    const data = await exportContactData(serverDeps(), user, id);
    const name = `Auskunft_${data.person.lastName}_${data.person.firstName}`.replace(/[^\w-]/g, "_");
    const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    if (format === "pdf") {
      const pdf = await exportContactPdf(data);
      return new NextResponse(Buffer.from(pdf), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
    }
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.json"` },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return new NextResponse(null, { status: 403 });
    if (error instanceof DomainError) return new NextResponse(null, { status: 404 });
    throw error;
  }
}
