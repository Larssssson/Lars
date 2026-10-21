import { NextResponse } from "next/server";
import { adapters } from "@/lib/adapters";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/** Dateien ausliefern (Anhänge, Logos). Alle angemeldeten Nutzer sehen alle Kunden (BRIEFING 3.2). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const file = await prisma.file.findUnique({ where: { id } }).catch(() => null);
  if (!file) return new NextResponse(null, { status: 404 });
  // Importdateien enthalten Kontaktdaten: nur für die Person, die sie hochgeladen hat
  if ((file.storageKey.startsWith("imports/") || file.storageKey.startsWith("monitoring/")) && file.uploadedBy !== user.id) return new NextResponse(null, { status: 404 });
  const data = await adapters.fileStorage().get(file.storageKey);
  const inline = file.mimeType.startsWith("image/") && file.mimeType !== "image/svg+xml";
  return new NextResponse(Buffer.from(data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
