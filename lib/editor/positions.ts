import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Positionen im Dokument finden: Bausteine, Fundstellen der Prüfung, Bereiche der KI-Bausteine.
 * Ohne DOM, damit es auch ohne Browser testbar ist.
 */

export type Range = { from: number; to: number };

/** Baustein mit Startposition und Bereich seines Inhalts. */
export function findBlock(doc: PMNode, key: string): { node: PMNode; pos: number; contentFrom: number; contentTo: number } | null {
  let found: { node: PMNode; pos: number; contentFrom: number; contentTo: number } | null = null;
  doc.forEach((node, offset) => {
    if (!found && node.type.name === "templateBlock" && node.attrs.key === key) {
      found = { node, pos: offset, contentFrom: offset + 1, contentTo: offset + node.nodeSize - 1 };
    }
  });
  return found;
}

/** Textstelle in einem Baustein (gelöschter Text zählt nicht mit, Leerraum wird zusammengefasst). */
export function findInBlock(doc: PMNode, key: string, quote: string): Range | null {
  const block = findBlock(doc, key);
  if (!block) return null;
  const chars: { ch: string; pos: number }[] = [];
  let lastWasSpace = true;
  doc.nodesBetween(block.contentFrom, block.contentTo, (node, pos) => {
    if (node.isBlock && chars.length && !lastWasSpace) {
      chars.push({ ch: " ", pos });
      lastWasSpace = true;
    }
    if (!node.isText || node.marks.some((m) => m.type.name === "deletion")) return;
    const text = node.text ?? "";
    for (let i = 0; i < text.length; i++) {
      const ch = /\s/.test(text[i]!) ? " " : text[i]!;
      if (ch === " " && lastWasSpace) continue;
      chars.push({ ch, pos: pos + i });
      lastWasSpace = ch === " ";
    }
  });
  const haystack = chars.map((c) => c.ch).join("");
  const needle = quote.replace(/\s+/g, " ").trim();
  if (!needle) return null;
  const index = haystack.indexOf(needle);
  if (index < 0) return null;
  return { from: chars[index]!.pos, to: chars[index + needle.length - 1]!.pos + 1 };
}

export type AiBlockView = { id: string; kind: string; text: string; from: number; to: number };

/** Offene KI-Bausteine im Dokument, zusammengefasst je ID. */
export function listAiInsertions(doc: PMNode): AiBlockView[] {
  const byId = new Map<string, AiBlockView>();
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type.name === "aiInsertion");
    if (!mark) return;
    const id = String(mark.attrs.id);
    const existing = byId.get(id);
    if (existing) {
      existing.text += node.text ?? "";
      existing.to = pos + node.nodeSize;
    } else {
      byId.set(id, { id, kind: String(mark.attrs.kind), text: node.text ?? "", from: pos, to: pos + node.nodeSize });
    }
  });
  return [...byId.values()];
}

/** Alle Textbereiche eines KI-Bausteins. */
export function aiRanges(doc: PMNode, id: string): Range[] {
  const ranges: Range[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.marks.some((m) => m.type.name === "aiInsertion" && m.attrs.id === id)) {
      const last = ranges[ranges.length - 1];
      if (last && last.to === pos) last.to = pos + node.nodeSize;
      else ranges.push({ from: pos, to: pos + node.nodeSize });
    }
  });
  return ranges;
}

/**
 * Wohin ein KI-Baustein kommt (BRIEFING 8.2, DECISIONS D-074): anstelle der Markierung oder an der
 * Cursorposition. Eine Headline gehört in den Baustein Headline: steht der Cursor nicht darin,
 * ersetzt sie dessen Inhalt; ebenso ersetzt "Lead straffen" ohne Markierung den ganzen Lead.
 * Ein Zitat ohne Cursor im Text kommt ans Ende des Bausteins Zitat.
 */
export function insertionTarget(doc: PMNode, selection: Range & { empty: boolean; focused: boolean }, kind: string): Range {
  const blockKey = kind === "HEADLINE" ? "headline" : kind === "ZITAT" ? "zitat" : kind === "LEAD" ? "lead" : null;
  const block = blockKey ? findBlock(doc, blockKey) : null;
  const inBlock = Boolean(block && selection.focused && selection.from > block.contentFrom && selection.to < block.contentTo);
  const whole = block && { from: block.contentFrom + 1, to: block.contentTo - 1 };
  if (whole && (kind === "HEADLINE" || kind === "LEAD") && !inBlock) return whole;
  if (!selection.empty) return { from: selection.from, to: selection.to };
  if (whole && kind === "LEAD") return whole;
  if (block && !selection.focused) {
    if (block.node.textContent.trim() === "") return { from: block.contentFrom + 1, to: block.contentFrom + 1 };
    return { from: block.contentTo - 1, to: block.contentTo - 1 };
  }
  return { from: selection.from, to: selection.to };
}
