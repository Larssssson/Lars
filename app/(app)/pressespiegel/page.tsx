import { pressReviewAction } from "@/app/(app)/pressespiegel/actions";
import { ArticleCard } from "@/components/monitoring/article-card";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { todayRelevant } from "@/lib/domain/monitoring/relevance";
import { cardClients } from "@/lib/domain/monitoring/view";
import { requireUser } from "@/lib/session";

/** "Heute relevant" je Kunde (BRIEFING 7.6 Schritt 4) mit "Pressespiegel erstellen" (Schritt 8). */
export default async function TodayPage() {
  const user = await requireUser();
  const now = new Date();
  const clients = await cardClients(prisma, user.selectedClientId);
  const lists = await Promise.all(clients.map((c) => todayRelevant(prisma, c.id, now)));
  const m = t.monitoring;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{m.today.hint}{user.selectedClientId ? "" : ` ${m.today.chooseClient}`}</p>
      {clients.map((client, i) => (
        <section key={client.id} className="flex flex-col gap-3" aria-labelledby={`today-${client.id}`} data-testid={`today-${client.name}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`today-${client.id}`} className="text-lg font-semibold">{m.today.perClient(client.name)}</h2>
            <ActionForm action={pressReviewAction.bind(null, client.id)} className="flex flex-col items-end">
              <SubmitButton size="sm" variant="outline">{m.review.create}</SubmitButton>
            </ActionForm>
          </div>
          {lists[i]!.length === 0 ? (
            <p className="text-sm text-muted-foreground">{m.today.empty}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {lists[i]!.map((article) => <ArticleCard key={article.id} article={article} clients={[client]} />)}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
