import type { NextConfig } from "next";

/**
 * Hinter einer Weiterleitung (GitHub Codespaces: *.app.github.dev) kommt die Anfrage mit anderem Host an,
 * als der Browser zeigt; diese Adressen dürfen Server Actions auslösen (DECISIONS D-121).
 */
const forwardedHosts = (process.env.ALLOWED_FORWARDED_HOSTS ?? (process.env.CODESPACES === "true" ? "*.app.github.dev" : ""))
  .split(",")
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
