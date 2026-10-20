import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import type { Priority, TaskStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

const priorityStyles: Record<Priority, string> = {
  DRINGEND: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  HOCH: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  NORMAL: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
  NIEDRIG: "border-neutral-300 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge className={priorityStyles[priority]}>{t.tasks.priorities[priority]}</Badge>;
}

const statusStyles: Partial<Record<TaskStatus, string>> = {
  FREIGABE_ANGEFRAGT: "border-violet-300 text-violet-800 dark:border-violet-700 dark:text-violet-200",
  AENDERUNGEN_ANGEFORDERT: "border-orange-300 text-orange-800 dark:border-orange-700 dark:text-orange-200",
  FREIGEGEBEN: "border-emerald-300 text-emerald-800 dark:border-emerald-700 dark:text-emerald-200",
  BEIM_KUNDEN: "border-cyan-300 text-cyan-800 dark:border-cyan-700 dark:text-cyan-200",
  ERLEDIGT: "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge className={cn("bg-background", statusStyles[status])}>{t.tasks.statuses[status]}</Badge>;
}
