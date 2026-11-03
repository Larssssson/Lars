import type { NextConfig } from "next";

/**
 * Hinter einer Weiterleitung kommt die Anfrage mit anderen Adressen an, als der Browser zeigt. GitHub Codespaces
 * meldet die öffentliche Adresse (*.app.github.dev) als x-forwarded-host und schreibt den Origin auf
 * localhost:3000 um. Im Entwicklungsmodus sind beide erlaubt, im Betrieb nur ALLOWED_FORWARDED_HOSTS (DECISIONS D-121).
 */
const forwardedHosts = [
  ...(process.env.ALLOWED_FORWARDED_HOSTS ?? "").split(","),
  ...(process.env.NODE_ENV === "production" ? [] : ["*.app.github.dev", `localhost:${process.env.PORT ?? 3000}`]),
]
  .map((h) => h.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: forwardedHosts,
  experimental: { serverActions: { allowedOrigins: forwardedHosts } },
  // eigener Build-Ordner für Ende-zu-Ende-Tests (playwright.config.ts)
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Prisma-Client und Treiber bleiben serverseitig ungebündelt.
  serverExternalPackages: ["pg", "pg-boss", "@prisma/client", "@prisma/adapter-pg", "playwright", "mammoth", "web-push", "@azure/storage-blob"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Service Worker nie zwischenspeichern, damit Updates sofort greifen (BRIEFING 10.3)
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
