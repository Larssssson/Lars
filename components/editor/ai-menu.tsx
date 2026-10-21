"use client";

import { useEffect, useState, useTransition } from "react";
import { suggestAiAction } from "@/app/(app)/aufgaben/[id]/actions";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

export type AiKind = "HEADLINE" | "ZITAT" | "LEAD";
type Result = { kind: AiKind; options: string[]; model: string; promptVersion: string; note?: string };

/**
 * KI-Bausteine (BRIEFING 8.2): Headline-Vorschläge (eine von drei wählen), Zitat mit gewähltem
 * Sprecher, Lead straffen. Eingefügt wird erst nach der Auswahl, markiert als KI.
 */
export function AiMenu(props: {
  taskId: string;
  speakers: { id: string; name: string }[];
  request: { kind: AiKind; nonce: number } | null;
  onInsert: (input: { kind: AiKind; text: string; model: string; promptVersion: string }) => Promise<string | null>;
}) {
  const a = t.ai;
  const [speakerId, setSpeakerId] = useState(props.speakers[0]?.id ?? "");
  const [result, setResult] = useState<Result | null>(null);
  const [choice, setChoice] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const generate = (kind: AiKind) =>
    start(async () => {
      setError(null);
      setResult(null);
      if (kind === "ZITAT" && !speakerId) {
        setError(a.noSpeakers);
        return;
      }
      const r = await suggestAiAction(props.taskId, kind, kind === "ZITAT" ? speakerId : undefined);
      if (r.error || !r.options || !r.model || !r.promptVersion) {
        setError(r.error ?? a.invalidOutput);
        return;
      }
      setChoice(0);
      setResult({ kind, options: r.options, model: r.model, promptVersion: r.promptVersion, note: r.note });
    });

  // Angebot aus einem Prüfhinweis ("Zitat fehlt", "Headline erklärt den Inhalt nicht", BRIEFING 7.4)
  useEffect(() => {
    if (props.request) generate(props.request.kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.request?.nonce]);

  return (
    <div className="flex flex-col gap-2 border-b bg-sky-50/50 px-3 py-2 text-sm dark:bg-sky-950/30" data-testid="ai-menu">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-sm bg-sky-600 px-1 text-[10px] font-bold text-white">{a.label}</span>
        <span className="text-xs font-medium">{a.menu}</span>
        <Button size="sm" variant="outline" className="h-7" disabled={pending} onClick={() => generate("HEADLINE")}>{a.headlines}</Button>
        <span className="flex items-center gap-1">
          <label htmlFor="ai-speaker" className="sr-only">{a.chooseSpeaker}</label>
          <select id="ai-speaker" value={speakerId} onChange={(e) => setSpeakerId(e.currentTarget.value)} className="h-7 max-w-40 rounded border border-input bg-background px-1 text-xs" disabled={!props.speakers.length}>
            {props.speakers.length === 0 && <option value="">{a.noSpeakers}</option>}
            {props.speakers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button size="sm" variant="outline" className="h-7" disabled={pending || !props.speakers.length} onClick={() => generate("ZITAT")}>{a.quote}</Button>
        </span>
        <Button size="sm" variant="outline" className="h-7" disabled={pending} onClick={() => generate("LEAD")}>{a.lead}</Button>
        {pending && <span className="text-xs text-muted-foreground" role="status">{a.generating}</span>}
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {result && (
        <form className="flex flex-col gap-2 rounded-md border border-sky-300 bg-background p-2" onSubmit={async (e) => {
          e.preventDefault();
          const text = result.options[choice];
          if (!text) return;
          const err = await props.onInsert({ kind: result.kind, text, model: result.model, promptVersion: result.promptVersion });
          if (err) setError(err);
          else setResult(null);
        }}>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-xs font-medium">{result.kind === "HEADLINE" ? a.chooseHeadline : a.kinds[result.kind]}</legend>
            {result.options.map((option, i) => (
              <label key={i} className="flex items-start gap-2">
                {result.options.length > 1 && <input type="radio" name="ai-option" checked={choice === i} onChange={() => setChoice(i)} className="mt-1" />}
                <span className="ai-preview">{option}</span>
              </label>
            ))}
          </fieldset>
          {result.note && <p className="text-xs text-amber-700 dark:text-amber-300">{result.note}</p>}
          <p className="text-xs text-muted-foreground">{a.placeholderHint}</p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="h-7">{a.insert}</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setResult(null)}>{t.tasks.cancel}</Button>
          </div>
        </form>
      )}
    </div>
  );
}
