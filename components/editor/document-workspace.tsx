"use client";

/*
 * Die ProseMirror-Plugins (Änderungsverfolgung) und die Zeitgeber lesen den aktuellen Zustand
 * außerhalb des Renderns. Dafür sind veränderliche Refs nötig; die React-Compiler-Regeln für
 * Refs sind hier deshalb bewusst ausgeschaltet.
 */
/* eslint-disable react-hooks/refs, react-hooks/immutability */

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  addCommentAction,
  claimAction,
  createInsertionAction,
  decideInsertionAction,
  openDocumentAction,
  releaseLockAction,
  requestLockAction,
  resolveThreadAction,
  saveContentAction,
  setTrackChangesAction,
} from "@/app/(app)/aufgaben/[id]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { t } from "@/i18n";
import { structureFindings, type FormatRules, type Strictness } from "@/lib/domain/documents/structure-check";
import { blockTexts, charCount, commentThreadIds, lineCount, type JSONNode } from "@/lib/editor/content";
import { aiRanges, findBlock, findInBlock, insertionTarget, listAiInsertions, type AiBlockView } from "@/lib/editor/positions";
import { decideAll, decideChange, listChanges, SKIP_TRACKING, type TrackedChange } from "@/lib/editor/track-changes";
import { cn } from "@/lib/utils";
import { AiMenu, type AiKind } from "./ai-menu";
import { CheckPanel, type CheckView, type FindingView } from "./check-panel";
import { clientExtensions } from "./extensions";
import { JournalistsPanel } from "./journalists-panel";
import { KnowledgePanel, type KnowledgeView } from "./knowledge-panel";
import { Toolbar } from "./toolbar";

export type CommentView = {
  id: string;
  threadId: string;
  body: string;
  authorName: string;
  createdAt: string;
  resolvedAt: string | null;
  anchor: { threadId?: string; quote?: string; wholeText?: boolean } | null;
};

type Props = {
  taskId: string;
  me: { id: string; name: string };
  ownerId: string;
  initialContent: JSONNode;
  initialStatus: string;
  trackChangesOn: boolean;
  /** darf grundsätzlich schreiben oder als Freigeber übernehmen */
  mayEdit: boolean;
  autoClaim: boolean;
  comments: CommentView[];
  banner?: ReactNode;
  /** Schalter "KI erlaubt" des Kunden (BRIEFING 7.7) */
  aiAllowed: boolean;
  knowledge: KnowledgeView;
  check: CheckView | null;
  strictness: Strictness;
  formatRules: FormatRules;
};

const AUTOSAVE_MS = 5_000;
const IDLE_MS = 10 * 60 * 1000;
const POLL_MS = 5_000;
const timeFmt = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" });

type Mode = "loading" | "editing" | "reading" | "expired";
type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: string } | { kind: "error"; message: string };

/**
 * Arbeitsplatz Mitte und rechts (BRIEFING 7.2): Editor mit Bausteinen, Sperre, Mitlesen,
 * Änderungsverfolgung, Kommentaren und Seitenleiste.
 */
export function DocumentWorkspace(props: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [holder, setHolder] = useState<string | null>(null);
  const [claimedBy, setClaimedBy] = useState<string | null>(null);
  const [lockRequestedBy, setLockRequestedBy] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"kommentare" | "aenderungen" | "pruefung" | "journalisten" | "kundenwissen">("kommentare");
  const [trackOn, setTrackOn] = useState(props.trackChangesOn);
  const [pendingAnchor, setPendingAnchor] = useState<{ from: number; to: number; quote: string } | null>(null);
  const [aiRequest, setAiRequest] = useState<{ kind: AiKind; nonce: number } | null>(null);
  /** letzte Cursorposition im Text; Klicks in Seitenleiste oder KI-Menü nehmen dem Editor den Fokus */
  const lastSelection = useRef<{ from: number; to: number; empty: boolean; focused: boolean }>({ from: 0, to: 0, empty: true, focused: false });

  const isOwner = props.me.id === props.ownerId;
  const editingRef = useRef(false);
  const trackRef = useRef(props.trackChangesOn || !isOwner);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInput = useRef(0);
  const statusRef = useRef(props.initialStatus);

  const extensions = useMemo(
    () => clientExtensions({ tracking: () => editingRef.current && trackRef.current, user: () => props.me }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const flush = useCallback(async (): Promise<boolean> => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!dirtyRef.current || !editingRef.current) return true;
    dirtyRef.current = false;
    setSave({ kind: "saving" });
    // TipTap liefert Attribute als Objekte ohne Prototyp; Server Actions brauchen einfaches JSON
    const result = await saveContentAction(props.taskId, JSON.parse(JSON.stringify(editorRef.current?.getJSON() ?? null)));
    if (result?.error) {
      dirtyRef.current = true;
      setSave({ kind: "error", message: result.error });
      return false;
    }
    setSave({ kind: "saved", at: timeFmt.format(new Date()) });
    return true;
  }, [props.taskId]);

  const editor = useEditor({
    extensions,
    content: props.initialContent,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: "document-editor", "aria-label": t.documents.editor } },
    onSelectionUpdate: ({ editor: e }) => {
      if (!e.isFocused) return;
      const { from, to, empty } = e.state.selection;
      lastSelection.current = { from, to, empty, focused: true };
    },
    onUpdate: ({ transaction }) => {
      if (!editingRef.current || transaction.getMeta("remote")) return;
      dirtyRef.current = true;
      lastInput.current = Date.now();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
  });
  const editorRef = useRef(editor);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const view = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { chars: 0, changes: [] as TrackedChange[], hasSelection: false, threads: new Set<string>(), aiBlocks: [] as AiBlockView[], live: [] as ReturnType<typeof structureFindings> };
      const json = e.getJSON() as JSONNode;
      return {
        chars: charCount(json),
        changes: listChanges(e.state.doc),
        hasSelection: !e.state.selection.empty,
        threads: commentThreadIds(json),
        aiBlocks: listAiInsertions(e.state.doc),
        // regelbasierte Live-Hinweise ohne KI (BRIEFING 7.4)
        live: structureFindings({ blocks: blockTexts(json), rules: props.formatRules, speakers: props.knowledge.speakers.map((sp) => sp.name), strictness: props.strictness }),
      };
    },
  });

  const startEditing = useCallback(() => {
    editingRef.current = true;
    lastInput.current = Date.now();
    editorRef.current?.setEditable(true);
    setMode("editing");
    setHolder(props.me.name);
  }, [props.me.name]);

  const stopEditing = useCallback((next: Mode) => {
    editingRef.current = false;
    editorRef.current?.setEditable(false);
    setMode(next);
  }, []);

  const tryEdit = useCallback(async () => {
    const result = await openDocumentAction(props.taskId);
    if (result.editing) startEditing();
    else {
      stopEditing("reading");
      setHolder(result.holderName);
    }
  }, [props.taskId, startEditing, stopEditing]);

  // Öffnen und bei jedem Statuswechsel: Freigeber übernehmen die Prüfung (BRIEFING 6.4),
  // wer schreiben darf, sperrt (7.3). Der Arbeitsplatz bleibt dabei bestehen, damit die Sperre
  // nicht zwischendurch frei wird.
  useEffect(() => {
    if (!editor) return;
    statusRef.current = props.initialStatus;
    let cancelled = false;
    (async () => {
      if (props.autoClaim) {
        const claim = await claimAction(props.taskId, false);
        if (cancelled) return;
        if (!claim.claimed) {
          stopEditing("reading");
          return;
        }
      }
      if (cancelled) return;
      if (props.mayEdit || props.autoClaim) {
        if (!editingRef.current) await tryEdit();
      } else {
        dirtyRef.current = false;
        stopEditing("reading");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editor, props.autoClaim, props.mayEdit, props.initialStatus, props.taskId, stopEditing, tryEdit]);

  /** Inhalt vom Server übernehmen, wenn er sich vom Editor unterscheidet (Vergleich des Inhalts, nicht der Zeit). */
  const applyRemote = useCallback((content: JSONNode) => {
    const current = editorRef.current;
    if (!current || dirtyRef.current) return;
    try {
      if (current.schema.nodeFromJSON(content).eq(current.state.doc)) return;
    } catch {
      return;
    }
    current.chain().command(({ tr }) => {
      tr.setMeta("remote", true).setMeta("addToHistory", false);
      return true;
    }).setContent(content, { emitUpdate: false }).run();
  }, []);

  // neuerer Inhalt vom Server (z. B. nach Word-Import) ersetzt den Editorinhalt, wenn nichts ungespeichert ist
  useEffect(() => {
    if (editor) applyRemote(props.initialContent);
  }, [editor, applyRemote, props.initialContent]);

  // Mitlesen, Anfragen und Statuswechsel anderer erkennen
  useEffect(() => {
    if (!editor) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/dokumente/${props.taskId}/zustand`, { cache: "no-store" });
      if (!res.ok) return;
      const state = await res.json();
      setClaimedBy(state.claim?.claimedByName ?? null);
      if (state.status !== statusRef.current) {
        statusRef.current = state.status;
        router.refresh();
      }
      if (editingRef.current) {
        setLockRequestedBy(state.lock.requestedByName);
        if (state.lock.holderId && state.lock.holderId !== props.me.id) {
          stopEditing("reading");
          setHolder(state.lock.holderName);
        }
        return;
      }
      setHolder(state.lock.holderName);
      applyRemote(state.content);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [editor, applyRemote, props.me.id, props.taskId, router, stopEditing]);

  // Sperre fällt nach 10 Minuten ohne Eingabe (BRIEFING 7.3)
  useEffect(() => {
    const timer = setInterval(async () => {
      if (editingRef.current && Date.now() - lastInput.current > IDLE_MS) {
        await flush();
        await releaseLockAction(props.taskId);
        stopEditing("expired");
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, [flush, props.taskId, stopEditing]);

  // beim Schließen: letzte Eingaben sichern und Sperre lösen
  useEffect(() => {
    const onHide = () => {
      if (!editingRef.current) return;
      const body = dirtyRef.current ? JSON.stringify({ content: editorRef.current?.getJSON() }) : "{}";
      navigator.sendBeacon(`/api/dokumente/${props.taskId}/sperre`, new Blob([body], { type: "application/json" }));
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      if (editingRef.current) void flush().then(() => releaseLockAction(props.taskId));
    };
  }, [flush, props.taskId]);

  const decide = (change: TrackedChange | "all", accept: boolean) => {
    if (!editor || !editingRef.current) return;
    editor.view.dispatch(change === "all" ? decideAll(editor.state, accept) : decideChange(editor.state, change, accept));
  };

  const beginComment = () => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    setPendingAnchor(empty ? null : { from, to, quote: editor.state.doc.textBetween(from, to, " ").slice(0, 300) });
    setTab("kommentare");
    setTimeout(() => document.getElementById("new-comment")?.focus(), 0);
  };

  const submitComment = async (body: string) => {
    let anchorThreadId: string | null = null;
    if (pendingAnchor && editor && editingRef.current) {
      anchorThreadId = crypto.randomUUID();
      editor.chain().setTextSelection({ from: pendingAnchor.from, to: pendingAnchor.to }).setMark("comment", { threadId: anchorThreadId }).run();
      if (!(await flush())) return t.documents.saveFailed;
    }
    const result = await addCommentAction(props.taskId, { body, anchorThreadId, quote: pendingAnchor?.quote ?? null });
    if (result?.error) return result.error;
    setPendingAnchor(null);
    router.refresh();
    return null;
  };

  /** Fundstelle anspringen und markieren (BRIEFING 7.4). */
  const jumpTo = (anchor: FindingView["anchor"]) => {
    if (!editor || "wholeText" in anchor) return;
    const block = findBlock(editor.state.doc, anchor.blockKey);
    if (!block) return;
    const range = (anchor.quote && findInBlock(editor.state.doc, anchor.blockKey, anchor.quote)) || { from: block.contentFrom + 1, to: block.contentFrom + 1 };
    editor.chain().focus().setTextSelection(range).scrollIntoView().run();
    const dom = editor.view.nodeDOM(block.pos);
    if (dom instanceof HTMLElement && !anchor.quote) dom.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /** KI-Baustein einfügen: erst der Datensatz, dann die Markierung im Text (BRIEFING 8.2). */
  const insertAi = async (input: { kind: AiKind; text: string; model: string; promptVersion: string }): Promise<string | null> => {
    if (!editor || !editingRef.current) return t.ai.needsEditing;
    const created = await createInsertionAction(props.taskId, input);
    if (created.error || !created.id) return created.error ?? t.errors.unexpected;
    const target = insertionTarget(editor.state.doc, lastSelection.current, input.kind);
    editor
      .chain()
      .insertContentAt(target, { type: "text", text: input.text, marks: [{ type: "aiInsertion", attrs: { id: created.id, kind: input.kind } }] })
      .run();
    const end = editor.state.selection.to;
    lastSelection.current = { from: end, to: end, empty: true, focused: true };
    return (await flush()) ? null : t.documents.saveFailed;
  };

  /** Übernehmen entfernt nur die Markierung, Verwerfen den Text (BRIEFING 8.2); beides ohne Änderungsverfolgung. */
  const decideAi = async (block: AiBlockView, accept: boolean) => {
    if (!editor || !editingRef.current) return;
    await flush();
    const result = await decideInsertionAction(props.taskId, block.id, accept);
    if (result?.error) {
      setNotice(result.error);
      return;
    }
    const tr = editor.state.tr.setMeta(SKIP_TRACKING, true);
    const ranges = aiRanges(editor.state.doc, block.id);
    if (accept) ranges.forEach((r) => tr.removeMark(r.from, r.to, editor.schema.marks.aiInsertion));
    else [...ranges].reverse().forEach((r) => tr.delete(r.from, r.to));
    editor.view.dispatch(tr);
    await flush();
    router.refresh();
  };

  /** Fakten und Boilerplate aus dem Kundenwissen an der Cursorposition einfügen, ohne KI-Markierung. */
  const insertKnowledge = (text: string) => {
    if (!editor || !editingRef.current) return;
    const lines = text.split(/\n+/).filter(Boolean);
    const { from, to } = lastSelection.current;
    const content = lines.length > 1 ? lines.map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })) : { type: "text", text };
    editor.chain().focus().insertContentAt({ from: Math.max(1, from), to: Math.max(1, to) }, content).run();
    const end = editor.state.selection.to;
    lastSelection.current = { from: end, to: end, empty: true, focused: true };
  };

  const highlight = (threadId: string) => {
    document.querySelectorAll(".comment-active").forEach((el) => el.classList.remove("comment-active"));
    const marks = document.querySelectorAll(`[data-comment="${threadId}"]`);
    marks.forEach((el) => el.classList.add("comment-active"));
    marks[0]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const d = t.documents;
  const editing = mode === "editing";
  const forcedTracking = !isOwner;
  const openFindings = props.check?.findings.filter((f) => f.status === "OFFEN").length ?? 0;

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-3">
        {props.banner}
        {mode === "reading" && holder && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            <span data-testid="lock-holder">{d.lockedBy(holder)}</span>
            {props.mayEdit && (
              <Button size="sm" variant="outline" onClick={async () => setNotice((await requestLockAction(props.taskId))?.ok ?? null)}>
                {d.requestEdit}
              </Button>
            )}
          </div>
        )}
        {mode === "reading" && !holder && props.mayEdit && (
          <div className="flex justify-end"><Button size="sm" onClick={() => void tryEdit()}>{d.resumeEditing}</Button></div>
        )}
        {mode === "expired" && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            {d.lockExpired}
            <Button size="sm" onClick={() => void tryEdit()}>{d.resumeEditing}</Button>
          </div>
        )}
        {editing && lockRequestedBy && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100">
            {d.lockRequestedBanner(lockRequestedBy)}
            <Button size="sm" variant="outline" onClick={async () => { await flush(); await releaseLockAction(props.taskId); stopEditing("reading"); setLockRequestedBy(null); }}>
              {d.yieldLock}
            </Button>
          </div>
        )}
        {claimedBy && claimedBy !== props.me.name && props.autoClaim && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            {t.approvals.claimedBy(claimedBy)}
            <Button size="sm" variant="outline" onClick={async () => {
              if (!window.confirm(t.approvals.confirmTakeOver(claimedBy))) return;
              await claimAction(props.taskId, true);
              await tryEdit();
              router.refresh();
            }}>
              {t.approvals.takeOver}
            </Button>
          </div>
        )}
        {notice && <p className="text-sm text-muted-foreground" role="status">{notice}</p>}

        <div className={cn("overflow-hidden rounded-lg border bg-card", !editing && "bg-muted/30")}>
          {editor && <Toolbar editor={editor} enabled={editing} canComment={editing ? true : false} onComment={beginComment} />}
          {editing && props.aiAllowed && (
            <AiMenu taskId={props.taskId} speakers={props.knowledge.speakers} request={aiRequest} onInsert={insertAi} />
          )}
          {(view?.aiBlocks.length ?? 0) > 0 && (
            <div className="flex flex-col gap-1 border-b bg-sky-50/50 px-3 py-2 text-xs dark:bg-sky-950/30" data-testid="ai-blocks">
              <p className="font-medium">{t.ai.openBlocks(view!.aiBlocks.length)}</p>
              {view!.aiBlocks.map((block) => (
                <div key={block.id} className="flex flex-wrap items-center gap-2">
                  <span className="rounded-sm bg-sky-600 px-1 text-[10px] font-bold text-white">{t.ai.label}</span>
                  <span className="font-medium">{t.ai.kinds[block.kind as keyof typeof t.ai.kinds] ?? block.kind}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{block.text}</span>
                  {editing && (
                    <>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => void decideAi(block, true)}>{t.ai.accept}</Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => void decideAi(block, false)}>{t.ai.discard}</Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          <EditorContent editor={editor} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground">
            <span data-testid="counter">{d.chars(view?.chars ?? 0)} · {d.lines(lineCount(view?.chars ?? 0))}</span>
            <span className="flex items-center gap-3">
              {(editing || mode === "loading") && isOwner && (
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={trackOn} disabled={!editing} onChange={async (e) => {
                    const on = e.currentTarget.checked;
                    setTrackOn(on);
                    trackRef.current = on;
                    await setTrackChangesAction(props.taskId, on);
                  }} />
                  {d.trackChanges}
                </label>
              )}
              {editing && forcedTracking && <span>{d.trackChangesForced}</span>}
              <span aria-live="polite" data-testid="save-state">
                {!editing ? d.readOnly : save.kind === "saving" ? d.saving : save.kind === "saved" ? d.saved(save.at) : save.kind === "error" ? save.message : ""}
              </span>
            </span>
          </div>
        </div>
        {editing && (
          <div className="rounded-md border border-dashed px-3 py-2 text-xs" data-testid="live-hints" aria-live="polite">
            <p className="font-medium text-muted-foreground">{t.checks.live}</p>
            {!view?.live.length ? <p className="text-muted-foreground">{t.checks.liveNone}</p> : (
              <ul className="mt-1 flex flex-col gap-0.5">
                {view.live.map((hint, i) => (
                  <li key={i}>
                    <button type="button" className="text-left hover:underline" onClick={() => jumpTo(hint.anchor)}>
                      <span className={hint.severity === "HINWEIS" ? "text-muted-foreground" : "text-orange-700 dark:text-orange-300"}>●</span> {hint.message}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-3">
        <div role="tablist" aria-label={d.editor} className="flex flex-wrap gap-1 rounded-md border p-1">
          {(["kommentare", "aenderungen", "pruefung", "journalisten", "kundenwissen"] as const).map((key) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={cn("rounded px-2 py-1 text-xs", tab === key ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
              {d.tabs[key]}
              {key === "aenderungen" && view?.changes.length ? ` (${view.changes.length})` : ""}
              {key === "pruefung" && openFindings ? ` (${openFindings})` : ""}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="rounded-lg border bg-card p-3 text-sm">
          {tab === "kommentare" && (
            <Comments
              comments={props.comments}
              anchoredThreads={view?.threads ?? new Set()}
              pendingQuote={pendingAnchor?.quote ?? null}
              canAnchor={editing}
              hasSelection={Boolean(view?.hasSelection)}
              onSubmit={submitComment}
              onClearAnchor={() => setPendingAnchor(null)}
              onReply={async (threadId, body) => {
                const r = await addCommentAction(props.taskId, { body, threadId });
                if (!r?.error) router.refresh();
                return r?.error ?? null;
              }}
              onResolve={async (threadId, resolved) => { await resolveThreadAction(props.taskId, threadId, resolved); router.refresh(); }}
              onHighlight={highlight}
              onAnchorSelection={beginComment}
            />
          )}
          {tab === "aenderungen" && (
            <div className="flex flex-col gap-2">
              {!view?.changes.length ? <p className="text-muted-foreground">{d.changes.none}</p> : (
                <>
                  {editing && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => decide("all", true)}>{d.changes.acceptAll}</Button>
                      <Button size="sm" variant="ghost" onClick={() => decide("all", false)}>{d.changes.rejectAll}</Button>
                    </div>
                  )}
                  <ul className="flex flex-col divide-y" data-testid="changes">
                    {view.changes.map((change) => (
                      <li key={change.id} className="flex flex-col gap-1 py-2">
                        <span className="text-xs text-muted-foreground">
                          {change.type === "insertion" ? d.changes.insertion : d.changes.deletion} · {d.changes.by(change.userName, change.at ? dateTimeFmt.format(new Date(change.at)) : "")}
                        </span>
                        <span className={change.type === "insertion" ? "change-insertion" : "change-deletion"}>{change.text}</span>
                        {editing && (
                          <span className="flex gap-2">
                            <Button size="sm" variant="outline" className="h-7" onClick={() => decide(change, true)}>{d.changes.accept}</Button>
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => decide(change, false)}>{d.changes.reject}</Button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          {tab === "pruefung" && (
            <CheckPanel
              taskId={props.taskId}
              check={props.check}
              strictness={props.strictness}
              aiAllowed={props.aiAllowed}
              canOfferAi={editing && props.aiAllowed}
              onJump={jumpTo}
              onOfferAi={(kind) => setAiRequest({ kind, nonce: Date.now() })}
              onDone={() => router.refresh()}
            />
          )}
          {tab === "journalisten" && <JournalistsPanel taskId={props.taskId} onBookmarkChange={() => router.refresh()} />}
          {tab === "kundenwissen" && <KnowledgePanel knowledge={props.knowledge} canInsert={editing} onInsert={insertKnowledge} />}
        </div>
      </aside>
    </div>
  );
}

function Comments(props: {
  comments: CommentView[];
  anchoredThreads: Set<string>;
  pendingQuote: string | null;
  canAnchor: boolean;
  hasSelection: boolean;
  onSubmit: (body: string) => Promise<string | null>;
  onClearAnchor: () => void;
  onReply: (threadId: string, body: string) => Promise<string | null>;
  onResolve: (threadId: string, resolved: boolean) => Promise<void>;
  onHighlight: (threadId: string) => void;
  onAnchorSelection: () => void;
}) {
  const c = t.documents.comments;
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const threads = new Map<string, CommentView[]>();
  for (const comment of props.comments) threads.set(comment.threadId, [...(threads.get(comment.threadId) ?? []), comment]);
  const visible = [...threads.values()].filter((thread) => showResolved || !thread[0]!.resolvedAt);

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const err = await props.onSubmit(body);
          setError(err);
          if (!err) setBody("");
        }}
      >
        <label htmlFor="new-comment" className="text-xs font-medium">
          {props.pendingQuote ? c.newOnSelection : c.newGeneral}
        </label>
        {props.pendingQuote && (
          <blockquote className="flex items-start justify-between gap-2 border-l-2 border-amber-400 pl-2 text-xs text-muted-foreground">
            „{props.pendingQuote}“
            <button type="button" className="underline" onClick={props.onClearAnchor} aria-label={t.tasks.cancel}>×</button>
          </blockquote>
        )}
        {!props.pendingQuote && props.canAnchor && (
          props.hasSelection
            ? <Button type="button" size="sm" variant="ghost" className="self-start" onClick={props.onAnchorSelection}>{c.newOnSelection}</Button>
            : <p className="text-xs text-muted-foreground">{c.selectFirst}</p>
        )}
        <Textarea id="new-comment" value={body} onChange={(e) => setBody(e.currentTarget.value)} placeholder={c.placeholder} className="min-h-16" />
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <Button type="submit" size="sm" className="self-start" disabled={!body.trim()}>{c.add}</Button>
      </form>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.currentTarget.checked)} /> {c.showResolved}
      </label>
      {visible.length === 0 ? <p className="text-muted-foreground">{c.none}</p> : (
        <ul className="flex flex-col gap-3" data-testid="comment-threads">
          {visible.map((thread) => <Thread key={thread[0]!.threadId} thread={thread} anchored={props.anchoredThreads.has(thread[0]!.threadId)} {...props} />)}
        </ul>
      )}
    </div>
  );
}

function Thread({ thread, anchored, onReply, onResolve, onHighlight }: {
  thread: CommentView[];
  anchored: boolean;
  onReply: (threadId: string, body: string) => Promise<string | null>;
  onResolve: (threadId: string, resolved: boolean) => Promise<void>;
  onHighlight: (threadId: string) => void;
}) {
  const c = t.documents.comments;
  const root = thread[0]!;
  const [reply, setReply] = useState("");
  const resolved = Boolean(root.resolvedAt);
  return (
    <li className={cn("rounded-md border p-2", resolved && "opacity-70")}>
      {root.anchor?.wholeText ? (
        <p className="mb-1 text-xs text-muted-foreground">{c.wholeText}</p>
      ) : (
        <button type="button" className="mb-1 block text-left text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => onHighlight(root.threadId)}>
          „{root.anchor?.quote}“{!anchored && ` · ${c.anchorMissing}`}
        </button>
      )}
      <ul className="flex flex-col gap-1.5">
        {thread.map((comment) => (
          <li key={comment.id}>
            <span className="text-xs font-medium">{comment.authorName}</span>{" "}
            <span className="text-xs text-muted-foreground">{dateTimeFmt.format(new Date(comment.createdAt))}</span>
            <p className="whitespace-pre-wrap">{comment.body}</p>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-col gap-1.5">
        {!resolved && (
          <form className="flex gap-1" onSubmit={async (e) => { e.preventDefault(); if (!(await onReply(root.threadId, reply))) setReply(""); }}>
            <label className="sr-only" htmlFor={`reply-${root.id}`}>{c.reply}</label>
            <input id={`reply-${root.id}`} value={reply} onChange={(e) => setReply(e.currentTarget.value)} placeholder={c.replyPlaceholder} className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-2 text-xs" />
            <Button type="submit" size="sm" variant="outline" className="h-7" disabled={!reply.trim()}>{c.reply}</Button>
          </form>
        )}
        <Button type="button" size="sm" variant="ghost" className="h-7 self-start" onClick={() => onResolve(root.threadId, !resolved)}>
          {resolved ? c.reopen : c.resolve}
        </Button>
      </div>
    </li>
  );
}
