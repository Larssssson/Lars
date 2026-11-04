import { NextResponse, type NextRequest } from "next/server";
import { t } from "@/i18n";

/**
 * Demo-Server (DECISIONS D-122): Mit DEMO_MODE=true schützt ein gemeinsames Passwort die ganze Seite
 * (HTTP Basic Auth, der Nutzername ist beliebig). Ohne Demo-Modus lässt der Proxy alles durch.
 * Der Gesundheitsendpunkt bleibt offen, damit die Plattform den Dienst überwachen kann.
 */
export function proxy(request: NextRequest) {
  const password = process.env.DEMO_PASSWORD ?? "";
  if (process.env.DEMO_MODE !== "true" || !password) return NextResponse.next();
  if (request.nextUrl.pathname === "/api/health") return NextResponse.next();
  if (demoPasswordMatches(request.headers.get("authorization"), password)) return NextResponse.next();
  return new NextResponse(null, {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${t.auth.demoPasswordRealm}", charset="UTF-8"` },
  });
}

/** Passwort aus dem Basic-Auth-Kopf vergleichen, ohne früh abzubrechen (gleiche Laufzeit). */
export function demoPasswordMatches(header: string | null, password: string): boolean {
  if (!header?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6).trim()), (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }
  const given = decoded.slice(decoded.indexOf(":") + 1);
  let diff = given.length ^ password.length;
  for (let i = 0; i < password.length; i++) diff |= password.charCodeAt(i) ^ (given.charCodeAt(i) || 0);
  return diff === 0;
}

export const config = {
  // statische Dateien laufen mit, damit ohne Passwort auch nichts von der Seite lädt
  matcher: "/:path*",
};
