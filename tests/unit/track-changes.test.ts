import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { blockTexts, charCount, cleanContent, commentThreadIds, lineCount, type JSONNode } from "@/lib/editor/content";
import { baseExtensions } from "@/lib/editor/extensions";
import { structureGuardPlugin } from "@/lib/editor/structure-guard";
import { decideAll, decideChange, listChanges, trackChangesPlugin, type ChangeUser } from "@/lib/editor/track-changes";

const schema = getSchema(baseExtensions());
const lukas: ChangeUser = { id: "lukas", name: "Lukas" };
const laura: ChangeUser = { id: "laura", name: "Laura" };

function docJson(...blocks: [string, string][]): JSONNode {
  return {
    type: "doc",
    content: blocks.map(([key, text]) => ({
      type: "templateBlock",
      attrs: { key, label: key, required: true },
      content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
    })),
  };
}

function setup(json: JSONNode, user: { current: ChangeUser }, enabled = { on: true }) {
  return EditorState.create({
    doc: PMNode.fromJSON(schema, json),
    plugins: [
      trackChangesPlugin({ enabled: () => enabled.on, user: () => user.current, now: () => new Date("2026-10-20T08:00:00Z") }),
      structureGuardPlugin(),
    ],
  });
}

/** Position des n-ten Zeichens im ersten Absatz des ersten Bausteins (doc > block > paragraph > text). */
const p = (offset: number) => 2 + offset;

function text(state: EditorState) {
  return state.doc.textContent;
}

describe("Änderungsverfolgung (BRIEFING 7.3)", () => {
  it("markiert Einfügungen mit Name und Zeit", () => {
    let state = setup(docJson(["headline", "Covenant baut"]), { current: lukas });
    state = state.apply(state.tr.insertText(" in Sachsen", p(13)));
    const changes = listChanges(state.doc);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ type: "insertion", userName: "Lukas", text: " in Sachsen", at: "2026-10-20T08:00:00.000Z" });
    expect(text(state)).toBe("Covenant baut in Sachsen");
  });

  it("fortlaufendes Tippen bleibt eine Änderung", () => {
    let state = setup(docJson(["lead", "Text"]), { current: lukas });
    let now = 0;
    for (const ch of " neu") {
      state = state.apply(state.tr.insertText(ch, p(4 + now)));
      now += 1;
    }
    expect(listChanges(state.doc).map((c) => c.text)).toEqual([" neu"]);
    const marks = new Set<string>();
    state.doc.descendants((n) => { n.marks.forEach((m) => m.type.name === "insertion" && marks.add(m.attrs.at)); });
    expect(marks.size).toBe(1);
  });

  it("löscht nicht, sondern markiert als Löschung", () => {
    let state = setup(docJson(["lead", "Es entstehen 600 Stellen"]), { current: lukas });
    state = state.apply(state.tr.delete(p(13), p(17)));
    expect(text(state)).toBe("Es entstehen 600 Stellen");
    const [change] = listChanges(state.doc);
    expect(change).toMatchObject({ type: "deletion", text: "600 ", userId: "lukas" });
  });

  it("Überschreiben zeigt Löschung und Einfügung", () => {
    let state = setup(docJson(["lead", "Es entstehen 600 Stellen"]), { current: lukas });
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, p(13), p(16))).replaceSelectionWith(schema.text("450"), true));
    expect(text(state)).toBe("Es entstehen 600450 Stellen");
    expect(listChanges(state.doc).map((c) => [c.type, c.text])).toEqual([["deletion", "600"], ["insertion", "450"]]);
  });

  it("Rücktaste setzt den Cursor vor die Löschung, damit weiteres Löschen weiterläuft", () => {
    let state = setup(docJson(["lead", "abcdef"]), { current: lukas });
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, p(6))));
    for (let i = 0; i < 2; i++) {
      const head = state.selection.from;
      state = state.apply(state.tr.delete(head - 1, head));
    }
    expect(text(state)).toBe("abcdef");
    expect(listChanges(state.doc).map((c) => c.text)).toEqual(["ef"]);
    expect(state.selection.from).toBe(p(4));
  });

  it("eigene, noch offene Einfügungen werden beim Löschen wirklich entfernt", () => {
    let state = setup(docJson(["lead", "Text"]), { current: lukas });
    state = state.apply(state.tr.insertText("neu", p(4)));
    state = state.apply(state.tr.delete(p(4), p(7)));
    expect(text(state)).toBe("Text");
    expect(listChanges(state.doc)).toHaveLength(0);
  });

  it("Einfügungen anderer bleiben beim Löschen als Löschung sichtbar", () => {
    const user = { current: laura };
    let state = setup(docJson(["lead", "Text"]), user);
    state = state.apply(state.tr.insertText(" Laura", p(4)));
    user.current = lukas;
    state = state.apply(state.tr.delete(p(4), p(10)));
    expect(text(state)).toBe("Text Laura");
    const changes = listChanges(state.doc);
    expect(changes.map((c) => [c.type, c.userName])).toEqual([["insertion", "Laura"], ["deletion", "Lukas"]]);
  });

  it("ohne eingeschaltete Verfolgung wird normal geschrieben", () => {
    let state = setup(docJson(["lead", "abc"]), { current: laura }, { on: false });
    state = state.apply(state.tr.delete(p(0), p(1)));
    expect(text(state)).toBe("bc");
    expect(listChanges(state.doc)).toHaveLength(0);
  });

  it("einzeln annehmen und ablehnen", () => {
    let state = setup(docJson(["lead", "Es entstehen 600 Stellen"]), { current: lukas });
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, p(13), p(16))).replaceSelectionWith(schema.text("450"), true));
    const [deletion, insertion] = listChanges(state.doc);
    state = state.apply(decideChange(state, deletion!, true));
    expect(text(state)).toBe("Es entstehen 450 Stellen");
    state = state.apply(decideChange(state, listChanges(state.doc)[0]!, false));
    expect(text(state)).toBe("Es entstehen  Stellen");
    expect(insertion?.type).toBe("insertion");
    expect(listChanges(state.doc)).toHaveLength(0);
  });

  it("alle annehmen oder alle ablehnen", () => {
    let state = setup(docJson(["headline", "Alt"], ["lead", "Eins zwei"]), { current: lukas });
    state = state.apply(state.tr.insertText("Neu ", p(0)));
    state = state.apply(state.tr.delete(state.doc.content.size - 6, state.doc.content.size - 2));
    const accepted = state.apply(decideAll(state, true));
    expect(accepted.doc.textContent).toBe("Neu AltEins ");
    const rejected = state.apply(decideAll(state, false));
    expect(rejected.doc.textContent).toBe("AltEins zwei");
    expect(listChanges(accepted.doc)).toHaveLength(0);
    expect(listChanges(rejected.doc)).toHaveLength(0);
  });
});

describe("Bausteine der Vorlage bleiben erhalten", () => {
  it("ein Löschen über Bausteingrenzen hinweg wird abgelehnt", () => {
    const state = setup(docJson(["headline", "Titel"], ["lead", "Text"]), { current: lukas }, { on: false });
    const tr = state.tr.delete(p(2), state.doc.content.size - 3);
    const next = state.apply(tr);
    expect(next.doc.childCount).toBe(2);
    expect(next.doc.textContent).toBe("TitelText");
  });
});

describe("Saubere Fassung und Zähler", () => {
  it("nimmt alle Änderungen an und entfernt Kommentaranker", () => {
    const json: JSONNode = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { key: "lead", label: "Lead", required: true },
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Es entstehen " },
                { type: "text", text: "600", marks: [{ type: "deletion", attrs: { userId: "x" } }] },
                { type: "text", text: "450", marks: [{ type: "insertion", attrs: { userId: "x" } }, { type: "bold" }] },
                { type: "text", text: " Stellen", marks: [{ type: "comment", attrs: { threadId: "t1" } }] },
              ],
            },
          ],
        },
      ],
    };
    const clean = cleanContent(json);
    expect(blockTexts(clean)[0]?.text).toBe("Es entstehen 450 Stellen");
    expect(JSON.stringify(clean)).not.toMatch(/insertion|deletion|comment/);
    expect(JSON.stringify(clean)).toContain("bold");
    expect(charCount(json)).toBe(24);
    expect(lineCount(61)).toBe(2);
    expect([...commentThreadIds(json)]).toEqual(["t1"]);
  });
});
