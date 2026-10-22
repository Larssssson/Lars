import type { NextConfig } from "next";

/** In GitHub Codespaces läuft impress hinter einer weitergeleiteten Adresse (*.app.github.dev). */
const forwardedHosts = process.env.CODESPACES === "true" ? ["*.app.github.dev"] : [];

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
