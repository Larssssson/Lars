import Link from "next/link";
import { Card } from "@/components/ui/card";
import { t } from "@/i18n";

/** Anmeldung ohne angelegten Nutzer: kein Zugriff, Hinweis auf CVD (BRIEFING 3.4). */
export default function NoAccessPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <Card>
        <h1 className="text-lg font-semibold">{t.auth.noAccessTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.auth.noAccessText}</p>
        <Link href="/login" className="mt-4 inline-block text-sm text-primary underline">
          {t.auth.backToLogin}
        </Link>
      </Card>
    </main>
  );
}
