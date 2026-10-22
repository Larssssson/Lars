"use client";

import { Extension, type AnyExtension } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { baseExtensions, TemplateBlock } from "@/lib/editor/extensions";
import { structureGuardPlugin } from "@/lib/editor/structure-guard";
import { trackChangesPlugin, type ChangeUser } from "@/lib/editor/track-changes";
import { TemplateBlockView } from "./template-block-view";

const TemplateBlockWithView = TemplateBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TemplateBlockView);
  },
});

/** Editor-Erweiterungen im Browser: Bausteine mit Beschriftung, Änderungsverfolgung, Schutz der Bausteine. */
export function clientExtensions(options: { tracking: () => boolean; user: () => ChangeUser | null }): AnyExtension[] {
  const tracking = Extension.create({
    name: "impressTracking",
    addProseMirrorPlugins() {
      return [trackChangesPlugin({ enabled: options.tracking, user: options.user }), structureGuardPlugin()];
    },
  });
  return [...baseExtensions().map((e) => (e.name === "templateBlock" ? TemplateBlockWithView : e)), tracking];
}
