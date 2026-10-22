import type { MetadataRoute } from "next";
import { t } from "@/i18n";

/** Web App Manifest: impress ist als PWA installierbar (BRIEFING 10.3). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: t.common.appName,
    short_name: t.common.appName,
    description: t.common.appClaim,
    lang: "de",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0B2540",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
