import Link from "next/link";
import { articleAction, fullTextAction } from "@/app/(app)/pressespiegel/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/form";
import { t } from "@/i18n";
import type { ArticleView } from "@/lib/domain/monitoring/relevance";
import type { CardClient } from "@/lib/domain/monitoring/view";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { SelectToggle } from "./select-toggle";


const KINDS = ["EINSCHAETZUNG", "LINKEDIN_KOMMENTAR", "NEWSHOOK_PITCH", "KONTAKT_UEBERNEHMEN"] as const;

/**
 * Ein Artikel (BRIEFING 7.6 Schritt 4): Headline, Medium, Autor, Datum, Teaser, Link, je Kunde Wert,
 * Begründung, Aufnehmen und die Aktionen für aufgenommene Artikel.
 */
export function ArticleCard({ article, clients, threshold }: { article: ArticleView; clients: CardClient[]; threshold: number }) {
  const m = t.monitoring;
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-4" data-testid="article">
      <div className="flex flex-col gap-0.5">
        <h3 className="font-semibold">
          {article.url ? <a href={article.url} target="_blank" rel="noreferrer" className="hover:underline">{article.headline}</a> : article.headline}
        </h3>
        <p className="text-xs text-muted-foreground">
          {article.mediaName} · {formatDate(article.publishedAt)}{article.authorName ? ` · ${article.authorName}` : ""} · {m.fields.authorInHub}:{" "}
          {article.journalistId ? <Link className="underline" href={`/journo-hub/${article.journalistId}`}>{m.yes}</Link> : m.no}
        </p>
        {article.teaser && <p className="text-sm">{article.teaser}</p>}
        {article.fullTextExpiresAt && <p className="text-xs text-muted-foreground">{m.fullTextStored(formatDate(article.fullTextExpiresAt))}</p>}
      </div>
      <ul className="flex flex-col gap-2">
        {clients.map((client) => {
          const relevance = article.relevances.find((r) => r.clientId === client.id);
          const actions = article.actions.filter((a) => a.clientId === client.id);
          return (
            <li key={client.id} className="flex flex-col gap-1.5 rounded-md bg-muted/40 p-2" data-testid={`relevance-${client.name}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{client.name}</span>
                <Badge className={cn(relevance?.score != null && relevance.score >= threshold ? "border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "")}>
                  {m.fields.score}: {relevance?.score ?? m.notRated}
                </Badge>
                <SelectToggle articleId={article.id} clientId={client.id} clientName={client.name} selected={Boolean(relevance?.selected)} />
              </div>
              {relevance?.reason && <p className="text-xs text-muted-foreground">{relevance.reason}</p>}
              {relevance?.selected && (
                <div className="flex flex-wrap items-start gap-1.5">
                  {KINDS.filter((k) => k !== "LINKEDIN_KOMMENTAR" || client.linkedin).map((kind) => (
                    <ActionForm key={kind} action={articleAction.bind(null, article.id, client.id, kind)}>
                      <SubmitButton size="sm" variant="outline" className="h-7">{m.actions[kind]}</SubmitButton>
                    </ActionForm>
                  ))}
                </div>
              )}
              {actions.length > 0 && (
                <ul className="flex flex-wrap gap-2 text-xs" data-testid="article-actions">
                  {actions.map((a, i) => (
                    <li key={i}>
                      {a.resultTaskId ? <Link className="underline" href={`/aufgaben/${a.resultTaskId}`}>{m.actions.done[a.kind] ?? a.kind}</Link> : a.resultJournalistId ? <Link className="underline" href={`/journo-hub/${a.resultJournalistId}`}>{m.actions.done[a.kind]}</Link> : null}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <details>
        <summary className="cursor-pointer text-xs">{m.fullText}</summary>
        <ActionForm action={fullTextAction.bind(null, article.id)} className="mt-2 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{m.fullTextHint}</p>
          <label className="sr-only" htmlFor={`fulltext-${article.id}`}>{m.fullText}</label>
          <Textarea id={`fulltext-${article.id}`} name="fullText" className="min-h-24" />
          <div><SubmitButton size="sm" variant="outline">{m.saveFullText}</SubmitButton></div>
        </ActionForm>
      </details>
    </li>
  );
}
