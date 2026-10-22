import { cleanContent, type JSONNode } from "@/lib/editor/content";

/**
 * Gemeinsames Modell für Word- und PDF-Export: Bausteine der sauberen Fassung mit ihrer Rolle.
 * Pressemitteilung und LinkedIn-Texte erscheinen ohne Bausteinnamen, alle anderen Formen
 * mit dem Namen des Bausteins als Zwischenzeile (DECISIONS D-055).
 */
export type BlockRole = "title" | "subtitle" | "kicker" | "lead" | "dateline" | "body";

export const ROLE_BY_KEY: Record<string, BlockRole> = {
  headline: "title",
  titel: "title",
  betreff: "title",
  subheadline: "subtitle",
  dachzeile: "kicker",
  lead: "lead",
  ortsmarke: "dateline",
};

const UNLABELED_FORMATS = new Set(["PRESSEMITTEILUNG", "LINKEDIN_POST", "LINKEDIN_KOMMENTAR"]);

export type RenderBlock = { key: string; label: string; role: BlockRole; showLabel: boolean; content: JSONNode[] };

export function renderBlocks(content: JSONNode, format: string): RenderBlock[] {
  const clean = cleanContent(content);
  return (clean.content ?? [])
    .map((block) => {
      const key = String(block.attrs?.key ?? "");
      const role = ROLE_BY_KEY[key] ?? "body";
      return {
        key,
        label: String(block.attrs?.label ?? key),
        role,
        showLabel: !UNLABELED_FORMATS.has(format) && role === "body",
        content: block.content ?? [],
      };
    })
    .filter((b) => b.content.some(hasText));
}

export function hasText(node: JSONNode): boolean {
  if (node.type === "text") return Boolean(node.text?.trim());
  return (node.content ?? []).some(hasText);
}

export type ExportTemplate = {
  /** Logo oben rechts als PNG oder JPEG */
  logo: { data: Uint8Array; type: "png" | "jpg"; width: number; height: number } | null;
  /** Akzentfarbe ohne #, z. B. 5BB5E5 (RP_LIGHT_BLUE) */
  color: string;
  font: string;
};
