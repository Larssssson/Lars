import Link from "next/link";
import { t } from "@/i18n";

export default function NotFound() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{t.errors.notFoundTitle}</h1>
      <p className="text-sm text-muted-foreground">{t.errors.notFoundText}</p>
      <Link href="/" className="text-sm underline">{t.errors.toDashboard}</Link>
    </div>
  );
}
