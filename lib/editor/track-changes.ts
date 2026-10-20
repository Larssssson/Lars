import { isHistoryTransaction } from "@tiptap/pm/history";
import { Fragment, Slice, type Mark, type MarkType, type Node as PMNode, type Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Mapping, ReplaceStep } from "@tiptap/pm/transform";

/**
 * Änderungsverfolgung als eigene ProseMirror-Erweiterung (BRIEFING 7.3).
 * Ist sie an, markiert das Plugin jede Einfügung mit "insertion" und ersetzt jede Löschung durch
 * denselben Text mit "deletion". Eigene, noch nicht angenommene Einfügungen werden wirklich gelöscht.
 * Strukturänderungen (Absatz teilen, Listen) werden nicht verfolgt.
 */

export const trackChangesKey = new PluginKey("trackChanges");
/** Meta für Transaktionen, die nicht verfolgt werden (Annehmen, Ablehnen, Laden). */
export const SKIP_TRACKING = "skipTracking";

export type ChangeUser = { id: string; name: string };

type Options = {
  enabled: () => boolean;
  user: () => ChangeUser | null;
  now?: () => Date;
};

function changeAttrs(user: ChangeUser, at: string) {
  return { userId: user.id, userName: user.name, at };
}

/**
 * Direkt anschließende Änderungen derselben Person übernehmen die Attribute der Nachbarmarkierung,
 * damit fortlaufendes Tippen oder Löschen eine Änderung bleibt und nicht pro Taste eine neue entsteht.
 */
function neighbourAttrs(doc: PMNode, pos: number, type: MarkType, user: ChangeUser): Record<string, unknown> | null {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  for (const node of [$pos.nodeBefore, $pos.nodeAfter]) {
    const mark = node?.marks.find((m) => m.type === type && m.attrs.userId === user.id);
    if (mark) return mark.attrs;
  }
  return null;
}

/** Gelöschten Inhalt als Löschung markieren; eigene Einfügungen fallen ganz weg. */
function markDeleted(fragment: Fragment, schema: Schema, user: ChangeUser, at: string, attrs?: Record<string, unknown> | null): Fragment {
  const deletion = schema.marks.deletion as MarkType;
  const insertion = schema.marks.insertion as MarkType;
  const nodes: PMNode[] = [];
  fragment.forEach((node) => {
    if (node.isText) {
      const ownInsertion = node.marks.find((m) => m.type === insertion && m.attrs.userId === user.id);
      if (ownInsertion) return;
      if (deletion.isInSet(node.marks)) {
        nodes.push(node);
        return;
      }
      nodes.push(node.mark(deletion.create(attrs ?? changeAttrs(user, at)).addToSet(node.marks)));
      return;
    }
    nodes.push(node.copy(markDeleted(node.content, schema, user, at, attrs)));
  });
  return Fragment.fromArray(nodes);
}

function hasText(fragment: Fragment): boolean {
  let found = false;
  fragment.descendants((n) => {
    if (n.isText && n.text) found = true;
    return !found;
  });
  return found;
}

export function trackChangesPlugin(options: Options): Plugin {
  return new Plugin({
    key: trackChangesKey,
    appendTransaction(transactions, oldState, newState) {
      if (!options.enabled()) return null;
      const user = options.user();
      if (!user) return null;
      const tracked = transactions.filter((tr) => tr.docChanged && !tr.getMeta(SKIP_TRACKING) && !isHistoryTransaction(tr));
      if (tracked.length === 0) return null;

      const at = (options.now?.() ?? new Date()).toISOString();
      const schema = newState.schema;
      const inserted: { from: number; to: number }[] = [];
      const deleted: { pos: number; slice: Slice; backspace: boolean }[] = [];

      // Zuordnung aller späteren Schritte, um Positionen ins Enddokument zu übertragen
      const allSteps = transactions.flatMap((tr) => tr.steps.map((step, i) => ({ tr, step, i })));
      allSteps.forEach(({ tr, step, i }, index) => {
        if (!tracked.includes(tr) || !(step instanceof ReplaceStep)) return;
        const rest = new Mapping(allSteps.slice(index + 1).map((s) => s.step.getMap()));
        const before = tr.docs[i] as PMNode;
        step.getMap().forEach((oldStart, oldEnd, newStart, newEnd) => {
          if (newEnd > newStart) inserted.push({ from: rest.map(newStart, 1), to: rest.map(newEnd, -1) });
          if (oldEnd > oldStart) {
            const slice = before.slice(oldStart, oldEnd);
            if (!hasText(slice.content)) return; // reine Strukturänderung
            const sel = oldState.selection;
            deleted.push({ pos: rest.map(newStart, -1), slice, backspace: sel.empty && oldEnd === sel.from && allSteps.length === 1 });
          }
        });
      });

      const tr = newState.tr;
      const insertion = schema.marks.insertion as MarkType;
      const deletion = schema.marks.deletion as MarkType;
      for (const range of inserted) {
        if (range.to <= range.from) continue;
        tr.removeMark(range.from, range.to, deletion);
        const attrs = neighbourAttrs(tr.doc, range.from, insertion, user) ?? changeAttrs(user, at);
        tr.addMark(range.from, range.to, insertion.create(attrs));
      }
      let cursor: number | null = null;
      for (const d of [...deleted].sort((a, b) => b.pos - a.pos)) {
        const pos = tr.mapping.map(d.pos, -1);
        const content = markDeleted(d.slice.content, schema, user, at, neighbourAttrs(tr.doc, pos, deletion, user));
        if (!hasText(content)) continue;
        const before = tr.doc.content.size;
        tr.replace(pos, pos, new Slice(content, d.slice.openStart, d.slice.openEnd));
        if (d.backspace) cursor = pos;
        else if (deleted.length === 1 && inserted.length === 0) cursor = pos + (tr.doc.content.size - before);
      }
      if (!tr.docChanged) return null;
      tr.setMeta(SKIP_TRACKING, true);
      if (cursor !== null) tr.setSelection(TextSelection.create(tr.doc, Math.min(cursor, tr.doc.content.size)));
      return tr;
    },
  });
}

// ------------------------------------------------------------- Änderungen auflisten, annehmen, ablehnen

export type TrackedChange = {
  id: string;
  type: "insertion" | "deletion";
  from: number;
  to: number;
  userId: string;
  userName: string;
  at: string;
  text: string;
};

/** Zusammenhängende Einfügungen bzw. Löschungen derselben Person bilden eine Änderung. */
export function listChanges(doc: PMNode): TrackedChange[] {
  const changes: TrackedChange[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const type of ["insertion", "deletion"] as const) {
      const mark: Mark | undefined = node.marks.find((m) => m.type.name === type);
      if (!mark) continue;
      const last = changes.findLast((c) => c.type === type);
      if (last && last.to === pos && last.userId === mark.attrs.userId) {
        last.to = pos + node.nodeSize;
        last.text += node.text ?? "";
        continue;
      }
      changes.push({
        id: `${type}-${pos}`,
        type,
        from: pos,
        to: pos + node.nodeSize,
        userId: mark.attrs.userId,
        userName: mark.attrs.userName,
        at: mark.attrs.at,
        text: node.text ?? "",
      });
    }
  });
  return changes.sort((a, b) => a.from - b.from);
}

function applyDecision(tr: Transaction, change: TrackedChange, accept: boolean): void {
  const schema = tr.doc.type.schema;
  const markType = schema.marks[change.type] as MarkType;
  const remove = (change.type === "insertion") !== accept; // Einfügung ablehnen oder Löschung annehmen
  if (remove) tr.delete(change.from, change.to);
  else tr.removeMark(change.from, change.to, markType);
}

export function decideChange(state: EditorState, change: TrackedChange, accept: boolean): Transaction {
  const tr = state.tr.setMeta(SKIP_TRACKING, true);
  applyDecision(tr, change, accept);
  return tr;
}

/** Alle Änderungen annehmen oder ablehnen, von hinten nach vorn, damit Positionen stimmen. */
export function decideAll(state: EditorState, accept: boolean): Transaction {
  const tr = state.tr.setMeta(SKIP_TRACKING, true);
  for (const change of listChanges(state.doc).reverse()) applyDecision(tr, change, accept);
  return tr;
}
