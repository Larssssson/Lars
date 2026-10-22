/** Baustein einer Darstellungsform (BRIEFING 7.3). */
export type FormatBlock = { key: string; label: string; required: boolean };

/**
 * Leeres Dokument aus der Vorlage der Darstellungsform: ein Block je Baustein.
 * Das Format ist TipTap-JSON; der Editor in Phase 2 kennt den Knoten "templateBlock".
 */
export function buildTemplateContent(blocks: FormatBlock[]) {
  return {
    type: "doc",
    content: blocks.map((block) => ({
      type: "templateBlock",
      attrs: { key: block.key, label: block.label, required: block.required },
      content: [{ type: "paragraph" }],
    })),
  };
}

/** Dokument mit Texten je Baustein, für Seeds und Tests. */
export function buildFilledContent(blocks: FormatBlock[], texts: Record<string, string>) {
  return {
    type: "doc",
    content: blocks.map((block) => ({
      type: "templateBlock",
      attrs: { key: block.key, label: block.label, required: block.required },
      content: (texts[block.key] ?? "")
        .split("\n\n")
        .map((para) => (para ? { type: "paragraph", content: [{ type: "text", text: para }] } : { type: "paragraph" })),
    })),
  };
}

export function parseBlocks(value: unknown): FormatBlock[] {
  return Array.isArray(value) ? (value as FormatBlock[]) : [];
}
