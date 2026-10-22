import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/** Meta für Transaktionen, die die Bausteine ändern dürfen (Laden, Import). */
export const ALLOW_STRUCTURE = "allowStructure";

function blockKeys(doc: PMNode): string {
  const keys: string[] = [];
  doc.forEach((node) => keys.push(String(node.attrs.key)));
  return keys.join("|");
}

/** Die Bausteine der Vorlage bleiben erhalten: kein Löschen, Verschieben oder Zusammenführen (BRIEFING 7.3). */
export function structureGuardPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey("structureGuard"),
    filterTransaction(tr, state) {
      if (!tr.docChanged || tr.getMeta(ALLOW_STRUCTURE)) return true;
      return blockKeys(tr.doc) === blockKeys(state.doc);
    },
  });
}
