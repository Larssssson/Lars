import type { Metadata } from "next";
import type { ReactNode } from "react";
import { t } from "@/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: t.common.appName,
  description: t.common.appClaim,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
