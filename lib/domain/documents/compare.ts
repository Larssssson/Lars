import { diffWords } from "diff";
import { blockTexts, type JSONNode } from "@/lib/editor/content";

export type DiffPart = { text: string; kind: "same" | "added" | "removed" };

/**
 * Zwei Versionen je Baustein vergleichen (BRIEFING 7.3), auf Wortebene, saubere Fassung.
 * Links stehen gleiche und entfernte Teile, rechts gleiche und hinzugefügte.
 */
export function compareVersions(older: JSONNode, newer: JSONNode) {
  const a = blockTexts(older);
  const b = blockTexts(newer);
  return b.map((block) => {
    const before = a.find((x) => x.key === block.key)?.text ?? "";
    const parts = diffWords(before, block.text);
    const left: DiffPart[] = parts.filter((p) => !p.added).map((p) => ({ text: p.value, kind: p.removed ? "removed" : "same" }));
    const right: DiffPart[] = parts.filter((p) => !p.removed).map((p) => ({ text: p.value, kind: p.added ? "added" : "same" }));
    return { key: block.key, label: block.label, left, right, changed: parts.some((p) => p.added || p.removed) };
  });
}
