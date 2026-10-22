import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

/** Status-Labels gut unterscheidbar in Farbe und Wort (BRIEFING 7.5). */
const styles: Record<string, string> = {
  VERIFIZIERT: "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100",
  MANUELL: "border-neutral-400 bg-neutral-50 text-neutral-800 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200",
  IMPORT: "border-sky-400 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100",
  PRESSESPIEGEL: "border-violet-400 bg-violet-50 text-violet-900 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100",
  KI_VORSCHLAG: "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
};

export function ContactStatusBadge({ status }: { status: string }) {
  return <Badge className={cn(styles[status])}>{t.journo.statuses[status] ?? status}</Badge>;
}
