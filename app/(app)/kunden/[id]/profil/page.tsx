import Link from "next/link";
import { notFound } from "next/navigation";
import { loadProfileContext } from "@/components/clients/profile-context";
import { DismissalRules, SectionCard, SuggestionList } from "@/components/clients/profile-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { PROFILE_SECTIONS } from "@/lib/domain/clients/profile-sections";
import { requireUser } from "@/lib/session";

/** Kundenprofil mit allen Abschnitten aus BRIEFING 7.7. */
export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const pc = await loadProfileContext(id, user);
  if (!pc) notFound();
  const { client } = pc.profile;
  const p = t.profile;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground"><Link href={`/kunden/${client.id}`} className="underline">{client.name}</Link></p>
          <h1 className="text-2xl font-semibold tracking-tight">{p.title}</h1>
          <p className="text-sm text-muted-foreground"><Badge>{t.common.clientStatus[client.status]}</Badge> {!client.aiAllowed && p.aiAllowedOff}</p>
        </div>
        {client.status === "ONBOARDING" && <Link href={`/kunden/${client.id}/onboarding`} className="text-sm font-medium underline">{p.onboarding.open}</Link>}
      </div>
      <nav aria-label={p.title} className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {PROFILE_SECTIONS.map((s) => <a key={s.key} href={`#abschnitt-${s.key}`} className="underline-offset-2 hover:underline">{p.sections[s.key]}</a>)}
      </nav>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          {PROFILE_SECTIONS.map((s) => <SectionCard key={s.key} pc={pc} sectionKey={s.key} />)}
        </div>
        <aside className="flex flex-col gap-4">
          <Card className="p-4">
            <CardTitle>{p.suggestions.title} <span className="text-sm font-normal text-muted-foreground">({pc.profile.suggestions.length})</span></CardTitle>
            <div className="mt-3"><SuggestionList pc={pc} /></div>
          </Card>
          <Card className="p-4">
            <CardTitle>{p.rules.title}</CardTitle>
            <div className="mt-3"><DismissalRules pc={pc} /></div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
