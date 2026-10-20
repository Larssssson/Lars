"use client";

import type { Editor } from "@tiptap/react";
import { Bold, Heading3, Italic, Link2, List, ListOrdered, MessageSquarePlus, Redo2, Table, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

function ToolButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("inline-flex size-8 items-center justify-center rounded hover:bg-accent disabled:opacity-40 [&_svg]:size-4", active && "bg-accent text-accent-foreground")}
    >
      {children}
    </button>
  );
}

export function Toolbar({ editor, enabled, canComment, onComment }: { editor: Editor; enabled: boolean; canComment: boolean; onComment: () => void }) {
  const tb = t.documents.toolbar;
  const chain = () => editor.chain().focus();
  return (
    <div role="toolbar" aria-label={tb.label} className="flex flex-wrap items-center gap-0.5 border-b bg-card px-2 py-1">
      <ToolButton label={tb.bold} disabled={!enabled} active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()}><Bold /></ToolButton>
      <ToolButton label={tb.italic} disabled={!enabled} active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()}><Italic /></ToolButton>
      <ToolButton label={tb.subheading} disabled={!enabled} active={editor.isActive("heading")} onClick={() => chain().toggleHeading({ level: 3 }).run()}><Heading3 /></ToolButton>
      <ToolButton label={tb.bulletList} disabled={!enabled} active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()}><List /></ToolButton>
      <ToolButton label={tb.orderedList} disabled={!enabled} active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()}><ListOrdered /></ToolButton>
      <ToolButton
        label={tb.link}
        disabled={!enabled}
        active={editor.isActive("link")}
        onClick={() => {
          const previous = editor.getAttributes("link").href as string | undefined;
          const href = window.prompt(tb.linkPrompt, previous ?? "https://");
          if (href === null) return;
          if (href === "") chain().unsetLink().run();
          else chain().extendMarkRange("link").setLink({ href }).run();
        }}
      >
        <Link2 />
      </ToolButton>
      <ToolButton label={tb.table} disabled={!enabled} onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table /></ToolButton>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <ToolButton label={tb.undo} disabled={!enabled} onClick={() => chain().undo().run()}><Undo2 /></ToolButton>
      <ToolButton label={tb.redo} disabled={!enabled} onClick={() => chain().redo().run()}><Redo2 /></ToolButton>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <ToolButton label={tb.comment} disabled={!canComment} onClick={onComment}><MessageSquarePlus /></ToolButton>
    </div>
  );
}
