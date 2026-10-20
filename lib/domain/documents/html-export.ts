import type { JSONNode } from "@/lib/editor/content";
import { renderBlocks, type ExportTemplate } from "./render-model";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(nodes: JSONNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "<br>";
      if (n.type !== "text") return "";
      let html = esc(n.text ?? "");
      for (const m of n.marks ?? []) {
        if (m.type === "bold") html = `<strong>${html}</strong>`;
        if (m.type === "italic") html = `<em>${html}</em>`;
        if (m.type === "link" && typeof m.attrs?.href === "string" && /^(https?:|mailto:)/.test(m.attrs.href)) {
          html = `<a href="${esc(m.attrs.href)}">${html}</a>`;
        }
      }
      return html;
    })
    .join("");
}

function blockHtml(nodes: JSONNode[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "paragraph":
          return `<p>${inline(n.content ?? [])}</p>`;
        case "heading":
          return `<h3>${inline(n.content ?? [])}</h3>`;
        case "bulletList":
        case "orderedList": {
          const tag = n.type === "bulletList" ? "ul" : "ol";
          return `<${tag}>${(n.content ?? []).map((li) => `<li>${blockHtml(li.content ?? [])}</li>`).join("")}</${tag}>`;
        }
        case "table":
          return `<table>${(n.content ?? [])
            .map((row) => `<tr>${(row.content ?? []).map((c) => { const t = c.type === "tableHeader" ? "th" : "td"; return `<${t}>${blockHtml(c.content ?? [])}</${t}>`; }).join("")}</tr>`)
            .join("")}</table>`;
        default:
          return "";
      }
    })
    .join("");
}

/** HTML-Vorlage für den PDF-Export (BRIEFING 10.1), saubere Fassung. */
export function buildHtml(input: { content: JSONNode; format: string; title: string; template: ExportTemplate }): string {
  const { template } = input;
  const color = `#${template.color}`;
  const logo = template.logo
    ? `<img class="logo" alt="" src="data:image/${template.logo.type === "jpg" ? "jpeg" : "png"};base64,${Buffer.from(template.logo.data).toString("base64")}" style="width:${template.logo.width}px;height:${template.logo.height}px">`
    : "";
  const body = renderBlocks(input.content, input.format)
    .map((b) => {
      const label = b.showLabel ? `<div class="label">${esc(b.label)}</div>` : "";
      return `<section class="role-${b.role}">${label}${blockHtml(b.content)}</section>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>${esc(input.title)}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  body { font-family: ${template.font}, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #1d2430; }
  header { display: flex; justify-content: flex-end; margin-bottom: 18px; }
  p { margin: 0 0 8px; }
  h3 { font-size: 12pt; color: ${color}; margin: 14px 0 6px; }
  .label { font-size: 9pt; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: ${color}; margin: 14px 0 4px; }
  .role-title p { font-size: 18pt; font-weight: 700; color: ${color}; line-height: 1.2; margin-bottom: 10px; }
  .role-subtitle p { font-size: 13pt; font-weight: 700; }
  .role-kicker p { font-size: 10pt; text-transform: uppercase; color: ${color}; margin-bottom: 4px; }
  .role-lead p { font-weight: 700; }
  .role-dateline p { font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { border: 1px solid #c9ced6; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: ${color}; color: #fff; }
  a { color: inherit; }
</style></head>
<body><header>${logo}</header>
${body}
</body></html>`;
}
