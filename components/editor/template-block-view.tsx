"use client";

import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { t } from "@/i18n";

/** Baustein der Vorlage mit fester Beschriftung (BRIEFING 7.3). */
export function TemplateBlockView({ node }: ReactNodeViewProps) {
  const { label, required, key } = node.attrs as { label: string; required: boolean; key: string };
  const empty = node.textContent.trim() === "";
  return (
    <NodeViewWrapper as="section" className="template-block" data-block={key} data-empty={empty ? "true" : undefined}>
      <div contentEditable={false} className="template-block-label" aria-hidden>
        {label}
        {required && <span className="template-block-required">{t.documents.required}</span>}
      </div>
      <NodeViewContent className="template-block-content" />
    </NodeViewWrapper>
  );
}
