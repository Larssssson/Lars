import { Mark, mergeAttributes, Node, type AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";

/**
 * Gemeinsame Editor-Erweiterungen für Browser und Server (BRIEFING 7.3).
 * Ein Dokument besteht nur aus Bausteinen der Darstellungsform (templateBlock);
 * darin Fließtext mit Fett, Kursiv, Listen, Links, Zwischenüberschriften und einfachen Tabellen.
 * Änderungsverfolgung und Kommentaranker sind eigene Markierungen (keine kostenpflichtigen Erweiterungen).
 */

export const TemplateDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "templateBlock+",
});

export const TemplateBlock = Node.create({
  name: "templateBlock",
  content: "block+",
  isolating: true,
  defining: true,
  selectable: false,
  draggable: false,
  addAttributes() {
    return {
      key: { default: "" },
      label: { default: "" },
      required: { default: false },
    };
  },
  parseHTML() {
    return [
      {
        tag: "section[data-block]",
        getAttrs: (el) => ({
          key: (el as HTMLElement).getAttribute("data-block") ?? "",
          label: (el as HTMLElement).getAttribute("data-label") ?? "",
          required: (el as HTMLElement).getAttribute("data-required") === "true",
        }),
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-block": node.attrs.key,
        "data-label": node.attrs.label,
        "data-required": String(node.attrs.required),
        class: "template-block",
      }),
      0,
    ];
  },
});

/** Attribute nicht als HTML-Attribute ausgeben; angezeigt werden nur Name und Zeit im Titel. */
const changeAttributes = {
  userId: { default: "", rendered: false },
  userName: { default: "", rendered: false },
  at: { default: "", rendered: false },
};

/** Einfügung im Änderungsmodus: farbig, mit Name und Zeit. */
export const Insertion = Mark.create({
  name: "insertion",
  inclusive: false,
  excludes: "",
  addAttributes() {
    return changeAttributes;
  },
  parseHTML() {
    return [{ tag: "ins[data-change]" }];
  },
  renderHTML({ mark, HTMLAttributes }) {
    return ["ins", mergeAttributes(HTMLAttributes, { "data-change": "insertion", title: `${mark.attrs.userName}, ${mark.attrs.at}`, class: "change-insertion" }), 0];
  },
});

/** Löschung im Änderungsmodus: Text bleibt sichtbar und durchgestrichen, bis sie angenommen wird. */
export const Deletion = Mark.create({
  name: "deletion",
  inclusive: false,
  excludes: "",
  addAttributes() {
    return changeAttributes;
  },
  parseHTML() {
    return [{ tag: "del[data-change]" }];
  },
  renderHTML({ mark, HTMLAttributes }) {
    return ["del", mergeAttributes(HTMLAttributes, { "data-change": "deletion", title: `${mark.attrs.userName}, ${mark.attrs.at}`, class: "change-deletion" }), 0];
  },
});

/** Anker eines Kommentars an einer Textstelle; mehrere Kommentare dürfen sich überlappen. */
export const CommentAnchor = Mark.create({
  name: "comment",
  inclusive: false,
  excludes: "",
  addAttributes() {
    return { threadId: { default: "", rendered: false } };
  },
  parseHTML() {
    return [{ tag: "span[data-comment]", getAttrs: (el) => ({ threadId: (el as HTMLElement).getAttribute("data-comment") }) }];
  },
  renderHTML({ mark, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-comment": mark.attrs.threadId, class: "comment-anchor" }), 0];
  },
});

export function baseExtensions(): AnyExtension[] {
  return [
    TemplateDocument,
    TemplateBlock,
    StarterKit.configure({
      document: false,
      code: false,
      codeBlock: false,
      blockquote: false,
      strike: false,
      underline: false,
      horizontalRule: false,
      trailingNode: false,
      heading: { levels: [3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
    }),
    TableKit.configure({ table: { resizable: false } }),
    Insertion,
    Deletion,
    CommentAnchor,
  ];
}
