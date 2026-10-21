"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

export type KnowledgeView = {
  clientId: string;
  coreMessages: string[];
  speakers: { id: string; name: string; function: string; quoteNeedsClientApproval: boolean }[];
  facts: { text: string; source?: string; date?: string }[];
  boilerplate: string;
  qa: string;
  finalTexts: { taskId: string; title: string; format: string }[];
};

/**
 * Reiter Kundenwissen (BRIEFING 7.2, 7.7): Kernbotschaften, Sprecher, Factsheet, Q&A und die letzten
 * fünf finalen Texte. Fakten und Boilerplate lassen sich an der Cursorposition einfügen; das ist
 * Profilwissen, kein KI-Text, und wird nicht markiert.
 */
export function KnowledgePanel({ knowledge, canInsert, onInsert }: { knowledge: KnowledgeView; canInsert: boolean; onInsert: (text: string) => void }) {
  const k = t.documents.knowledge;

  return (
    <div className="flex flex-col gap-4" data-testid="knowledge-panel">
      {!canInsert && <p className="text-xs text-muted-foreground">{k.insertNeedsEditing}</p>}
      <Section title={k.coreMessages} empty={!knowledge.coreMessages.length}>
        <ul className="list-disc pl-4">{knowledge.coreMessages.map((m) => <li key={m}>{m}</li>)}</ul>
      </Section>
      <Section title={k.speakers} empty={!knowledge.speakers.length}>
        <ul className="flex flex-col gap-1">
          {knowledge.speakers.map((s) => (
            <li key={s.id}>
              <span className="font-medium">{s.name}</span>{s.function && `, ${s.function}`}
              {s.quoteNeedsClientApproval && <span className="block text-xs text-muted-foreground">{k.quoteApproval}</span>}
            </li>
          ))}
        </ul>
      </Section>
      <Section title={k.facts} empty={!knowledge.facts.length}>
        <ul className="flex flex-col gap-1.5" data-testid="facts">
          {knowledge.facts.map((f, i) => (
            <li key={i} className="flex items-start justify-between gap-2">
              <span>
                {f.text}
                {(f.source || f.date) && <span className="block text-xs text-muted-foreground">{[f.source, f.date].filter(Boolean).join(", ")}</span>}
              </span>
              <InsertButton text={f.text} enabled={canInsert} onInsert={onInsert} />
            </li>
          ))}
        </ul>
      </Section>
      <Section title={k.boilerplate} empty={!knowledge.boilerplate}>
        <div className="flex items-start justify-between gap-2">
          <p className="whitespace-pre-wrap">{knowledge.boilerplate}</p>
          <InsertButton text={knowledge.boilerplate} enabled={canInsert} onInsert={onInsert} />
        </div>
      </Section>
      <Section title={k.qa} empty={!knowledge.qa}>
        <p className="line-clamp-6 whitespace-pre-wrap">{knowledge.qa}</p>
      </Section>
      <Section title={k.finalTexts} empty={!knowledge.finalTexts.length}>
        <ul className="flex flex-col gap-1">
          {knowledge.finalTexts.map((f) => (
            <li key={f.taskId}><Link className="underline" href={`/aufgaben/${f.taskId}`}>{f.title}</Link> <span className="text-xs text-muted-foreground">· {f.format}</span></li>
          ))}
        </ul>
      </Section>
      <Link className="text-xs underline" href={`/kunden/${knowledge.clientId}/profil`}>{k.openProfile}</Link>
    </div>
  );
}

function InsertButton({ text, enabled, onInsert }: { text: string; enabled: boolean; onInsert: (text: string) => void }) {
  if (!enabled) return null;
  return (
    <Button size="sm" variant="outline" className="h-6 shrink-0 px-2 text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => onInsert(text)}>
      {t.documents.knowledge.insert}
    </Button>
  );
}

function Section({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {empty ? <p className="text-xs text-muted-foreground">{t.documents.knowledge.empty}</p> : children}
    </section>
  );
}
