"use client";

import { useEffect } from "react";
import { answerQuestionAction, generateQuestionsAction, setOnboardingStepAction } from "@/app/(app)/kunden/[id]/profil/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Textarea } from "@/components/ui/form";
import { t } from "@/i18n";

/** Merkt sich den aktuellen Schritt, damit das Onboarding später dort weitergeht. */
export function StepMemory({ clientId, step }: { clientId: string; step: string }) {
  useEffect(() => {
    void setOnboardingStepAction(clientId, step);
  }, [clientId, step]);
  return null;
}

export function GenerateQuestionsButton({ clientId }: { clientId: string }) {
  return (
    <ActionForm action={generateQuestionsAction.bind(null, clientId)}>
      <SubmitButton size="sm" variant="outline">{t.profile.onboarding.generateQuestions}</SubmitButton>
    </ActionForm>
  );
}

export function AnswerForm({ clientId, index, question, answer }: { clientId: string; index: number; question: string; answer: string | null }) {
  const o = t.profile.onboarding;
  return (
    <ActionForm action={answerQuestionAction.bind(null, clientId, index)} className="flex flex-col gap-1.5">
      <label htmlFor={`answer-${index}`} className="text-sm font-medium">{question}</label>
      {answer && <p className="text-xs text-muted-foreground">{o.answered}: {answer}</p>}
      <Textarea id={`answer-${index}`} name="answer" className="min-h-16" placeholder={o.answer} required />
      <div><SubmitButton size="sm" variant="outline">{o.saveAnswer}</SubmitButton></div>
    </ActionForm>
  );
}
