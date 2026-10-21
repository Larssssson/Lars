import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { t } from "@/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: t.common.appName,
  description: t.common.appClaim,
  // iOS: als App vom Home-Bildschirm, nur dort funktioniert Push (BRIEFING 10.3)
  appleWebApp: { capable: true, title: t.common.appName, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0B2540" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
