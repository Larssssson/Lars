import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  Header,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphStyleOptions,
  type ParagraphChild,
} from "docx";
import type { JSONNode } from "@/lib/editor/content";
import { renderBlocks, type BlockRole, type ExportTemplate } from "./render-model";

/**
 * Word-Export der sauberen Fassung (BRIEFING 7.3) mit RP- oder Kundenvorlage.
 * Jeder Baustein bekommt einen eigenen Absatzstil "impress-<baustein>", damit ein
 * Rückläufer vom Kunden beim Import wieder in die richtigen Bausteine fällt.
 */
export const BLOCK_STYLE_PREFIX = "impress-";
export const SUBHEADING_SUFFIX = "-zwischenueberschrift";
export const LABEL_STYLE = "impress-bausteinname";

const ROLE_RUN: Record<BlockRole, { size: number; bold?: boolean; italics?: boolean; accent?: boolean; allCaps?: boolean }> = {
  title: { size: 36, bold: true, accent: true },
  subtitle: { size: 26, bold: true },
  kicker: { size: 20, allCaps: true, accent: true },
  lead: { size: 22, bold: true },
  dateline: { size: 22, italics: true },
  body: { size: 22 },
};

function inlineRuns(nodes: JSONNode[], base: { bold?: boolean } = {}): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const node of nodes) {
    if (node.type === "hardBreak") {
      out.push(new TextRun({ text: "", break: 1 }));
      continue;
    }
    if (node.type !== "text" || !node.text) continue;
    const marks = node.marks ?? [];
    const run = new TextRun({
      text: node.text,
      bold: base.bold || marks.some((m) => m.type === "bold") || undefined,
      italics: marks.some((m) => m.type === "italic") || undefined,
    });
    const link = marks.find((m) => m.type === "link");
    out.push(link ? new ExternalHyperlink({ link: String(link.attrs?.href ?? ""), children: [new TextRun({ text: node.text, style: "Hyperlink" })] }) : run);
  }
  return out;
}

function blockChildren(nodes: JSONNode[], key: string, color: string): (Paragraph | Table)[] {
  const style = `${BLOCK_STYLE_PREFIX}${key}`;
  const out: (Paragraph | Table)[] = [];
  for (const node of nodes) {
    if (node.type === "paragraph") out.push(new Paragraph({ style, children: inlineRuns(node.content ?? []) }));
    else if (node.type === "heading") out.push(new Paragraph({ style: `${style}${SUBHEADING_SUFFIX}`, children: inlineRuns(node.content ?? []) }));
    else if (node.type === "bulletList" || node.type === "orderedList") {
      for (const item of node.content ?? []) {
        for (const para of item.content ?? []) {
          out.push(
            new Paragraph({
              numbering: { reference: node.type === "bulletList" ? "aufzaehlung" : "nummerierung", level: 0 },
              children: inlineRuns(para.content ?? []),
            }),
          );
        }
      }
    } else if (node.type === "table") {
      out.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: (node.content ?? []).map(
            (row) =>
              new TableRow({
                children: (row.content ?? []).map((cell) => {
                  const header = cell.type === "tableHeader";
                  return new TableCell({
                    shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: color } : undefined,
                    children: (cell.content ?? []).map((p) => new Paragraph({ children: inlineRuns(p.content ?? [], { bold: header }) })),
                  });
                }),
              }),
          ),
        }),
      );
    }
  }
  return out;
}

export async function buildDocx(input: {
  content: JSONNode;
  format: string;
  title: string;
  template: ExportTemplate;
}): Promise<Uint8Array> {
  const { template } = input;
  const blocks = renderBlocks(input.content, input.format);
  const styles: IParagraphStyleOptions[] = [
    { id: LABEL_STYLE, name: LABEL_STYLE, basedOn: "Normal", run: { size: 18, bold: true, color: template.color, allCaps: true }, paragraph: { spacing: { before: 240, after: 60 } } },
  ];
  for (const block of blocks) {
    const r = ROLE_RUN[block.role];
    const id = `${BLOCK_STYLE_PREFIX}${block.key}`;
    if (styles.some((s) => s.id === id)) continue;
    styles.push({
      id,
      name: id,
      basedOn: "Normal",
      run: { size: r.size, bold: r.bold, italics: r.italics, allCaps: r.allCaps, color: r.accent ? template.color : undefined },
      paragraph: { spacing: { after: block.role === "title" ? 200 : 120 } },
    });
    styles.push({
      id: `${id}${SUBHEADING_SUFFIX}`,
      name: `${id}${SUBHEADING_SUFFIX}`,
      basedOn: "Normal",
      run: { size: 24, bold: true, color: template.color },
      paragraph: { spacing: { before: 200, after: 80 } },
    });
  }

  const children: (Paragraph | Table)[] = [];
  for (const block of blocks) {
    if (block.showLabel) children.push(new Paragraph({ style: LABEL_STYLE, children: [new TextRun(block.label)] }));
    children.push(...blockChildren(block.content, block.key, template.color));
  }

  const header = template.logo
    ? new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new ImageRun({
                type: template.logo.type,
                data: template.logo.data,
                transformation: { width: template.logo.width, height: template.logo.height },
              }),
            ],
          }),
        ],
      })
    : undefined;

  const doc = new Document({
    title: input.title,
    creator: "impress",
    styles: {
      default: { document: { run: { font: template.font, size: 22 } } },
      paragraphStyles: styles,
    },
    numbering: {
      config: [
        { reference: "aufzaehlung", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] },
        { reference: "nummerierung", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] },
      ],
    },
    sections: [{ headers: header ? { default: header } : undefined, children }],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
