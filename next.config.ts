import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // eigener Build-Ordner für Ende-zu-Ende-Tests (playwright.config.ts)
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Prisma-Client und Treiber bleiben serverseitig ungebündelt.
  serverExternalPackages: ["pg", "pg-boss", "@prisma/client", "@prisma/adapter-pg", "playwright", "mammoth"],
};

export default nextConfig;
