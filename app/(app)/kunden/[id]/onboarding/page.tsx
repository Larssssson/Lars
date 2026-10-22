import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadProfileContext } from "@/components/clients/profile-context";
import { AnswerForm, GenerateQuestionsButton, StepMemory } from "@/components/clients/onboarding";
import { SectionCard, SuggestionList, UploadForm } from "@/components/clients/profile-view";
import { StatusActions } from "@/components/clients/client-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { missingForActivation } from "@/lib/domain/clients/profile";
import { PROFILE_SECTIONS } from "@/lib/domain/clients/profile-sections";
import { canManageClients, profileAccess } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

/** Schritte: Unterlagen, dann Abschnitt für Abschnitt (BRIEFING 6.8, 7.7). */
const STEPS = ["unterlagen", ...PROFILE_SECTIONS.filter((s) => s.key !== "dokumente").map((s) => s.key)];

export default async function OnboardingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ schritt?: string }> }) {
  const { id } = await params;
  const { schritt } = await searchParams;
  const user = await requireUser();
  const pc = await loadProfileContext(id, user);
  if (!pc) notFound();
  const { client, onboarding } = pc.profile;
  if (profileAccess(user, pc.ctx, client.id) !== "EDIT") redirect(`/kunden/${client.id}/profil`);
  // ohne Angabe dort weitermachen, wo zuletzt aufgehört wurde (unterbrechbar)
  const step = STEPS.includes(schritt ?? "") ? schritt! : STEPS.includes(onboarding.step ?? "") ? onboarding.step! : STEPS[0]!;
  const index = STEPS.indexOf(step);
  const missing = await missingForActivation(prisma, client.id);
  const o = t.profile.onboarding;
  const questions = (onboarding.questions ?? []).map((q, i) => ({ ...q, index: i }));
  const stepQuestions = questions.filter((q) => q.sectionKey === step);
  const label = (key: string) => (key === "unterlagen" ? t.profile.documents.upload : t.profile.sections[key] ?? key);

  return (
    <div className="flex flex-col gap-5">
      <StepMemory clientId={client.id} step={step} />
      <div>
        <p className="text-sm text-muted-foreground"><Link href={`/kunden/${client.id}`} className="underline">{client.name}</Link></p>
        <h1 className="text-2xl font-semibold tracking-tight">{o.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{o.intro}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)_20rem]">
        <nav aria-label={o.title}>
          <ol className="flex flex-col gap-0.5 text-sm">
            {STEPS.map((key, i) => (
              <li key={key}>
                <Link href={`?schritt=${key}`} aria-current={key === step ? "step" : undefined}
                  className={cn("flex items-center justify-between rounded px-2 py-1 hover:bg-accent", key === step && "bg-accent font-medium")}>
                  <span>{i}. {label(key)}</span>
                  {missing.includes(key) && <span className="text-xs text-amber-700 dark:text-amber-300" aria-label={o.missing}>●</span>}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">{o.step(index + 1, STEPS.length)}</p>
          {step === "unterlagen" ? (
            <Card className="flex flex-col gap-3 p-4">
              <CardTitle>{t.profile.documents.upload}</CardTitle>
              <UploadForm pc={pc} />
              {pc.profile.files.length > 0 && (
                <ul className="text-sm">{pc.profile.files.map((f) => <li key={f.id}>{f.name}</li>)}</ul>
              )}
              <SuggestionList pc={pc} />
            </Card>
          ) : (
            <SectionCard pc={pc} sectionKey={step} openEdit />
          )}
          {stepQuestions.length > 0 && (
            <Card className="flex flex-col gap-3 p-4" data-testid="step-questions">
              <CardTitle>{o.questions}</CardTitle>
              {stepQuestions.map((q) => <AnswerForm key={q.index} clientId={client.id} index={q.index} question={q.question} answer={q.answer ?? null} />)}
            </Card>
          )}
          <div className="flex justify-between">
            {index > 0 ? <Link className="text-sm underline" href={`?schritt=${STEPS[index - 1]}`}>{o.back}</Link> : <span />}
            {index < STEPS.length - 1 && <Link className="text-sm font-medium underline" href={`?schritt=${STEPS[index + 1]}`}>{o.next}</Link>}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-4" data-testid="activation">
            {missing.length === 0 ? <p className="text-sm">{o.complete}</p> : (
              <>
                <CardTitle>{o.missing}</CardTitle>
                <ul className="mt-2 list-disc pl-5 text-sm">{missing.map((k) => <li key={k}><Link className="underline" href={`?schritt=${k}`}>{t.profile.sections[k]}</Link></li>)}</ul>
              </>
            )}
            {canManageClients(user) && client.status === "ONBOARDING" && <div className="mt-3"><StatusActions clientId={client.id} status={client.status} /></div>}
          </Card>
          <Card className="flex flex-col gap-3 p-4">
            <CardTitle>{o.questions}</CardTitle>
            {client.aiAllowed ? <GenerateQuestionsButton clientId={client.id} /> : <p className="text-xs text-muted-foreground">{t.profile.aiAllowedOff}</p>}
            {questions.length === 0 ? <p className="text-sm text-muted-foreground">{o.noQuestions}</p> : (
              <ul className="flex flex-col gap-1 text-sm" data-testid="questions">
                {questions.map((q) => (
                  <li key={q.index}>
                    <Link href={`?schritt=${q.sectionKey}`} className={cn("hover:underline", q.answer && "text-muted-foreground line-through")}>{q.question}</Link>
                    {q.answer && <span className="ml-1 text-xs text-muted-foreground">({o.answered})</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
