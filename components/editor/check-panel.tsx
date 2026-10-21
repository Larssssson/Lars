"use client";

import { useState, useTransition } from "react";
import { dismissFindingAction, findingDoneAction, runCheckAction } from "@/app/(app)/aufgaben/[id]/actions";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

export type FindingView = {
  id: string;
  category: string;
  severity: "KRITISCH" | "WICHTIG" | "HINWEIS";
  confidence: "HOCH" | "MITTEL" | "NIEDRIG";
  anchor: { blockKey: string; quote?: string } | { wholeText: true };
  message: string;
  reason: string;
  status: "OFFEN" | "ERLEDIGT" | "VERWORFEN";
  suggestion: "HEADLINE" | "ZITAT" | "LEAD" | "SONSTIGES" | null;
};

export type CheckView = {
  mode: "SCHNELL" | "VOLL";
  createdAt: string;
  label: string;
  outdated: boolean;
  conformity: number;
  resonance: number | null;
  warnings: string[];
  aiNotice: string | null;
  findings: FindingView[];
};

const CATEGORY_ORDER = ["STRUKTUR", "COMPLIANCE", "FAKTENTREUE", "STYLEGUIDE", "TONE", "RESONANZ", "ERWEITERUNG", "DISTRIBUTION"];
const SEVERITY_STYLE = {
  KRITISCH: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
  WICHTIG: "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100",
  HINWEIS: "border-border bg-muted text-foreground",
} as const;

/** Reiter Prüfung (BRIEFING 7.4): Modus wählen, Werte, Profilwarnungen, Hinweise nach Prüfschritt. */
export function CheckPanel(props: {
  taskId: string;
  check: CheckView | null;
  strictness: string;
  aiAllowed: boolean;
  canOfferAi: boolean;
  onJump: (anchor: FindingView["anchor"]) => void;
  onOfferAi: (kind: "HEADLINE" | "ZITAT" | "LEAD") => void;
  onDone: () => void;
}) {
  const c = t.checks;
  const [mode, setMode] = useState<"SCHNELL" | "VOLL">(props.check?.mode ?? "SCHNELL");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const open = props.check?.findings.filter((f) => f.status === "OFFEN") ?? [];
  const groups = CATEGORY_ORDER.map((cat) => ({ cat, items: open.filter((f) => f.category === cat) })).filter((g) => g.items.length);

  return (
    <div className="flex flex-col gap-3" data-testid="check-panel">
      <div className="flex flex-col gap-2">
        <div role="radiogroup" aria-label={c.tab} className="flex gap-1 rounded-md border p-1">
          {(["SCHNELL", "VOLL"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
              className={cn("flex-1 rounded px-2 py-1 text-xs", mode === m ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
              {m === "VOLL" ? c.full : c.quick}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{c.strictness}: {c.strictnessLevels[props.strictness]}</p>
        {!props.aiAllowed && <p className="text-xs text-muted-foreground">{c.aiOff}</p>}
        <Button size="sm" disabled={pending} onClick={() => start(async () => {
          const r = await runCheckAction(props.taskId, mode);
          setError(r?.error ?? null);
          props.onDone();
        })}>
          {pending ? c.running : c.start}
        </Button>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>

      {!props.check ? <p className="text-muted-foreground">{c.noRun}</p> : (
        <>
          <p className="text-xs text-muted-foreground">{props.check.label}</p>
          {props.check.outdated && <p className="text-xs text-amber-700 dark:text-amber-300">{c.outdated}</p>}
          <div className="grid grid-cols-2 gap-2" data-testid="check-scores">
            <Score label={c.conformity} value={props.check.conformity} />
            <Score label={c.resonance} value={props.check.resonance} hint={c.resonanceQuickHint} />
          </div>
          {props.check.aiNotice && <p className="rounded-md border px-2 py-1 text-xs text-muted-foreground">{props.check.aiNotice}</p>}
          {props.check.warnings.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" data-testid="check-warnings">
              <p className="font-medium">{c.profileWarnings}</p>
              <ul className="mt-1 list-disc pl-4">{props.check.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
          {groups.length === 0 ? <p className="text-muted-foreground">{c.noFindings}</p> : groups.map((g) => (
            <section key={g.cat} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{c.categories[g.cat]}</h3>
              <ul className="flex flex-col gap-2" data-testid="findings">
                {g.items.map((f) => <Finding key={f.id} finding={f} {...props} />)}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function Score({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div className="rounded-md border p-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value ?? "–"}</p>
      {value === null && hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Finding({ finding, taskId, canOfferAi, onJump, onOfferAi, onDone }: {
  finding: FindingView;
  taskId: string;
  canOfferAi: boolean;
  onJump: (anchor: FindingView["anchor"]) => void;
  onOfferAi: (kind: "HEADLINE" | "ZITAT" | "LEAD") => void;
  onDone: () => void;
}) {
  const c = t.checks;
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const [rule, setRule] = useState(false);
  const [pending, start] = useTransition();
  const anchor = finding.anchor;
  const offer = finding.suggestion && finding.suggestion !== "SONSTIGES" ? finding.suggestion : null;

  return (
    <li className={cn("flex flex-col gap-1.5 rounded-md border p-2", SEVERITY_STYLE[finding.severity])}>
      <p className="text-xs">
        <span className="font-semibold">{c.severity[finding.severity]}</span> · {c.confidence[finding.confidence]}
      </p>
      <p className="font-medium">{finding.message}</p>
      <p className="text-xs opacity-80">{finding.reason}</p>
      {"wholeText" in anchor ? (
        <p className="text-xs italic opacity-80">{c.wholeText}</p>
      ) : (
        <button type="button" className="self-start text-left text-xs underline" onClick={() => onJump(anchor)} title={c.jump}>
          {anchor.quote ? `„${anchor.quote}“` : c.jump}
        </button>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="h-7" disabled={pending} onClick={() => start(async () => { await findingDoneAction(taskId, finding.id); onDone(); })}>{c.done}</Button>
        <Button size="sm" variant="ghost" className="h-7" onClick={() => setDismissing((v) => !v)} aria-expanded={dismissing}>{c.dismiss}</Button>
        {offer && canOfferAi && (
          <Button size="sm" variant="outline" className="h-7 border-sky-400" onClick={() => onOfferAi(offer)}>{c.offerAi(t.ai.kinds[offer])}</Button>
        )}
      </div>
      {dismissing && (
        <form className="flex flex-col gap-1.5" onSubmit={(e) => {
          e.preventDefault();
          start(async () => { await dismissFindingAction(taskId, finding.id, { reason, createRule: rule }); onDone(); });
        }}>
          <label className="text-xs" htmlFor={`reason-${finding.id}`}>{c.dismissReason}</label>
          <input id={`reason-${finding.id}`} value={reason} onChange={(e) => setReason(e.currentTarget.value)} className="h-7 rounded border border-input bg-background px-2 text-xs" />
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={rule} onChange={(e) => setRule(e.currentTarget.checked)} /> {c.dismissRule}
          </label>
          <Button type="submit" size="sm" className="h-7 self-start" disabled={pending}>{c.dismissConfirm}</Button>
        </form>
      )}
    </li>
  );
}
