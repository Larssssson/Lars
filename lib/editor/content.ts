/**
 * Hilfsfunktionen auf dem gespeicherten Editor-JSON, ohne Editor und ohne Browser.
 * Die "saubere Fassung" (BRIEFING 7.3, DECISIONS D-019) enthält alle Änderungen angenommen,
 * ohne Änderungs- und Kommentarmarkierungen.
 */
export type JSONMark = { type: string; attrs?: Record<string, unknown> };
export type JSONNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JSONNode[];
  marks?: JSONMark[];
  text?: string;
};

const TRACKING_MARKS = new Set(["insertion", "deletion", "comment", "aiInsertion"]);

export function cleanContent(node: JSONNode): JSONNode {
  const copy: JSONNode = { ...node };
  if (node.marks) {
    const marks = node.marks.filter((m) => !TRACKING_MARKS.has(m.type));
    if (marks.length) copy.marks = marks;
    else delete copy.marks;
  }
  if (node.content) {
    copy.content = node.content
      .filter((child) => !(child.type === "text" && child.marks?.some((m) => m.type === "deletion")))
      .map(cleanContent);
    if (copy.content.length === 0 && node.type !== "doc") {
      // ein leerer Absatz bleibt gültig, leere Container bekommen einen leeren Absatz
      copy.content = node.type === "paragraph" || node.type === "heading" ? [] : [{ type: "paragraph" }];
      if (copy.content.length === 0) delete copy.content;
    }
  }
  return copy;
}

const BLOCK_TYPES = new Set(["paragraph", "heading", "listItem", "tableRow"]);

/** Klartext; Absätze durch Leerzeilen getrennt. */
export function plainText(node: JSONNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const parts = (node.content ?? []).map(plainText);
  if (node.type === "tableRow") return parts.join(" | ");
  const sep = (node.content ?? []).some((c) => BLOCK_TYPES.has(c.type) || c.type === "templateBlock" || c.type === "bulletList" || c.type === "orderedList" || c.type === "table") ? "\n" : "";
  return parts.filter((p, i) => p !== "" || sep === "" || i === 0).join(sep);
}

export type BlockText = { key: string; label: string; required: boolean; text: string };

/** Text je Baustein der sauberen Fassung. */
export function blockTexts(doc: JSONNode): BlockText[] {
  return (cleanContent(doc).content ?? []).map((block) => ({
    key: String(block.attrs?.key ?? ""),
    label: String(block.attrs?.label ?? ""),
    required: Boolean(block.attrs?.required),
    text: plainText(block).trim(),
  }));
}

/** Zeichen der sauberen Fassung ohne Zeilenumbrüche. */
export function charCount(doc: JSONNode): number {
  return blockTexts(doc).reduce((sum, b) => sum + b.text.replace(/\n/g, "").length, 0);
}

/** Normzeilen à 60 Anschläge (DECISIONS D-054). */
export const CHARS_PER_LINE = 60;
export function lineCount(chars: number): number {
  return Math.ceil(chars / CHARS_PER_LINE);
}

/** Offene Änderungen im gespeicherten Inhalt zählen. */
export function countTrackedChanges(node: JSONNode): number {
  let count = 0;
  const walk = (n: JSONNode) => {
    if (n.marks?.some((m) => m.type === "insertion" || m.type === "deletion")) count += 1;
    n.content?.forEach(walk);
  };
  walk(node);
  return count;
}

/** IDs der Kommentar-Threads, deren Anker noch im Text steht. */
export function commentThreadIds(node: JSONNode): Set<string> {
  const ids = new Set<string>();
  const walk = (n: JSONNode) => {
    n.marks?.forEach((m) => m.type === "comment" && m.attrs?.threadId && ids.add(String(m.attrs.threadId)));
    n.content?.forEach(walk);
  };
  walk(node);
  return ids;
}
