import Link from "next/link";
import { MarkAllReadButton, MarkReadButton } from "@/components/layout/notification-actions";
import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { listNotifications } from "@/lib/domain/notifications";
import { requireUser } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Glocke (BRIEFING 7.9): alle Benachrichtigungen, Push-Nachrichten sind markiert. */
export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(prisma, user.id);
  const n = t.notifications;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{n.title}</h1>
        {items.some((i) => !i.readAt) && <MarkAllReadButton />}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{n.empty}</p>
      ) : (
        <ul className="divide-y rounded-lg border" data-testid="notifications">
          {items.map((item) => (
            <li key={item.id} className={cn("flex flex-wrap items-center justify-between gap-2 px-4 py-3", !item.readAt && "bg-accent/40")}>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(item.createdAt)}
                  {item.isPush && <Badge className="ml-2">{n.push}</Badge>}
                  {!item.readAt && <span className="sr-only">, {n.unread}</span>}
                </span>
                {item.link ? <Link href={item.link} className={cn("hover:underline", !item.readAt && "font-medium")}>{item.title}</Link> : <span>{item.title}</span>}
              </div>
              {!item.readAt && <MarkReadButton id={item.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
