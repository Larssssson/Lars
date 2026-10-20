import mammoth from "mammoth";
import { parse, type HTMLElement, type Node as HtmlNode } from "node-html-parser";
import type { JSONMark, JSONNode } from "@/lib/editor/content";
import type { FormatBlock } from "./template";
import { BLOCK_STYLE_PREFIX, LABEL_STYLE, SUBHEADING_SUFFIX } from "./word-export";

/**
 * Word-Import (BRIEFING 7.3) mit mammoth: Text, Absätze, Fett, Kursiv, Listen, Überschriften, Links, Tabellen.
 * Absätze mit impress-Stil (aus unserem Export) landen in ihrem Baustein; alles andere im
 * Baustein davor bzw. im Haupttext. Die erste Überschrift einer fremden Datei wird die Headline.
 */
const MAIN_BLOCK_PRIORITY = ["haupttext", "text", "fragen", "hintergrund", "eintraege", "artikel", "massnahmen", "programm", "programmpunkte", "kurzfassung"];
const TITLE_KEYS = ["headline", "titel", "betreff"];

function mainBlock(blocks: FormatBlock[]): string {
  return MAIN_BLOCK_PRIORITY.find((k) => blocks.some((b) => b.key === k)) ?? blocks.at(-1)?.key ?? "";
}

function styleMap(blocks: FormatBlock[]): string[] {
  return [
    `p[style-name='${LABEL_STYLE}'] => !`,
    ...blocks.flatMap((b) => [
      `p[style-name='${BLOCK_STYLE_PREFIX}${b.key}${SUBHEADING_SUFFIX}'] => h3.blk-${b.key}:fresh`,
      `p[style-name='${BLOCK_STYLE_PREFIX}${b.key}'] => p.blk-${b.key}:fresh`,
    ]),
  ];
}

function inline(node: HtmlNode, marks: JSONMark[] = []): JSONNode[] {
  if (node.nodeType === 3) {
    const text = node.text.replace(/\s+/g, " ");
    return text ? [{ type: "text", text, ...(marks.length ? { marks } : {}) }] : [];
  }
  const el = node as HTMLElement;
  const tag = el.tagName?.toLowerCase();
  if (tag === "br") return [{ type: "hardBreak" }];
  let next = marks;
  if (tag === "strong" || tag === "b") next = [...marks, { type: "bold" }];
  if (tag === "em" || tag === "i") next = [...marks, { type: "italic" }];
  if (tag === "a" && el.getAttribute("href")) next = [...marks, { type: "link", attrs: { href: el.getAttribute("href") } }];
  return el.childNodes.flatMap((child) => inline(child, next));
}

function paragraph(el: HTMLElement): JSONNode {
  const content = inline(el);
  if (content[0]?.type === "text") content[0].text = content[0].text!.trimStart();
  const last = content.at(-1);
  if (last?.type === "text") last.text = last.text!.trimEnd();
  return { type: "paragraph", content: content.filter((c) => c.type !== "text" || c.text) };
}

function blockNode(el: HTMLElement): JSONNode | null {
  const tag = el.tagName?.toLowerCase();
  if (tag === "p") return paragraph(el);
  if (/^h[1-6]$/.test(tag ?? "")) return { type: "heading", attrs: { level: 3 }, content: paragraph(el).content };
  if (tag === "ul" || tag === "ol") {
    return {
      type: tag === "ul" ? "bulletList" : "orderedList",
      content: el.childNodes
        .filter((c): c is HTMLElement => (c as HTMLElement).tagName?.toLowerCase() === "li")
        .map((li) => ({ type: "listItem", content: [paragraph(li)] })),
    };
  }
  if (tag === "table") {
    const rows = el.querySelectorAll("tr");
    return {
      type: "table",
      content: rows.map((tr) => ({
        type: "tableRow",
        content: tr.childNodes
          .filter((c): c is HTMLElement => ["td", "th"].includes((c as HTMLElement).tagName?.toLowerCase() ?? ""))
          .map((cell) => ({
            type: cell.tagName.toLowerCase() === "th" ? "tableHeader" : "tableCell",
            content: cell.querySelectorAll("p").length ? cell.querySelectorAll("p").map(paragraph) : [paragraph(cell)],
          })),
      })),
    };
  }
  return null;
}

export async function importDocx(data: Uint8Array, blocks: FormatBlock[]): Promise<JSONNode> {
  const result = await mammoth.convertToHtml({ buffer: Buffer.from(data) }, { styleMap: styleMap(blocks), ignoreEmptyParagraphs: true });
  const root = parse(result.value);
  const byKey = new Map<string, JSONNode[]>(blocks.map((b) => [b.key, []]));
  const main = mainBlock(blocks);
  const titleKey = TITLE_KEYS.find((k) => byKey.has(k));
  let current: string | null = null;
  let titleTaken = false;

  for (const child of root.childNodes) {
    const el = child as HTMLElement;
    if (!el.tagName) continue;
    const cls = el.getAttribute("class") ?? "";
    const styled = /blk-([\w-]+)/.exec(cls)?.[1];
    let key: string;
    if (styled && byKey.has(styled)) key = styled;
    else if (!current && /^h[1-2]$/i.test(el.tagName) && titleKey && !titleTaken) key = titleKey;
    else key = current ?? main;
    if (key === titleKey) titleTaken = true;
    current = key === titleKey && !styled ? main : key;

    const node = /^h[1-6]$/i.test(el.tagName) && key === titleKey ? paragraph(el) : blockNode(el);
    if (node && (node.type !== "paragraph" || node.content?.length)) byKey.get(key)!.push(node);
  }

  return {
    type: "doc",
    content: blocks.map((b) => ({
      type: "templateBlock",
      attrs: { key: b.key, label: b.label, required: b.required },
      content: byKey.get(b.key)!.length ? byKey.get(b.key)! : [{ type: "paragraph" }],
    })),
  };
}
