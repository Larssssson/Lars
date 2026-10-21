import Link from "next/link";
import { ArticleCard } from "@/components/monitoring/article-card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { allArticles } from "@/lib/domain/monitoring/relevance";
import { cardClients } from "@/lib/domain/monitoring/view";
import { generalSettings } from "@/lib/domain/settings";
import { requireUser } from "@/lib/session";
import { addDays, startOfDay } from "@/lib/time";

type Params = { q?: string; von?: string; bis?: string };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "Alle Artikel" mit Suche und Zeitraum (BRIEFING 7.6 Schritt 4). */
export default async function AllArticlesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  const p = await searchParams;
  const from = p.von && DAY.test(p.von) ? startOfDay(p.von) : null;
  const to = p.bis && DAY.test(p.bis) ? new Date(startOfDay(addDays(p.bis, 1)).getTime() - 1) : null;
  const [articles, clients, settings] = await Promise.all([allArticles(prisma, { q: p.q, from, to }), cardClients(prisma, user.selectedClientId), generalSettings(prisma)]);
  const a = t.monitoring.all;
  return (
    <div className="flex flex-col gap-4">
      <form key={JSON.stringify(p)} method="get" className="grid gap-3 rounded-lg border p-4 sm:grid-cols-4" aria-label={a.apply}>
        <Field label={a.search} htmlFor="a-q"><Input id="a-q" name="q" defaultValue={p.q ?? ""} /></Field>
        <Field label={a.from} htmlFor="a-von"><Input id="a-von" name="von" type="date" defaultValue={p.von ?? ""} /></Field>
        <Field label={a.to} htmlFor="a-bis"><Input id="a-bis" name="bis" type="date" defaultValue={p.bis ?? ""} /></Field>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm">{a.apply}</Button>
          <Button asChild variant="ghost" size="sm"><Link href="/pressespiegel/alle">{t.journo.filter.reset}</Link></Button>
        </div>
      </form>
      <p className="text-sm text-muted-foreground" data-testid="article-count">{a.count(articles.length)}</p>
      {articles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{a.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {articles.map((article) => <ArticleCard key={article.id} article={article} clients={clients} threshold={settings.relevanceThreshold} />)}
        </ul>
      )}
    </div>
  );
}
