"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { t } from "@/i18n";
import { mentionQueryAt, splitMentions, type MentionUser } from "@/lib/editor/mentions";
import { cn } from "@/lib/utils";

/**
 * Eingabefeld für Kommentare mit @-Vorschlägen (DECISIONS D-127): nach „@“ erscheinen passende Namen,
 * Pfeiltasten wählen, Enter oder Tab übernimmt, Escape schließt. Übernommen wird „@Name “.
 */
export function MentionInput({
  id,
  value,
  onChange,
  users,
  placeholder,
  multiline = false,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  users: MentionUser[];
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}) {
  const listId = useId();
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const [query, setQuery] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);

  const matches = query
    ? users.filter((u) => u.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(query.query.toLowerCase())) || u.name.toLowerCase().startsWith(query.query.toLowerCase())).slice(0, 6)
    : [];
  // vollständig getippter Name: keine Liste mehr nötig
  const complete = matches.length === 1 && query !== null && [matches[0]!.name, matches[0]!.name.split(/\s+/)[0]!].some((n) => n.toLowerCase() === query.query.toLowerCase());
  const open = matches.length > 0 && !complete;

  const update = (text: string, caret: number) => {
    onChange(text);
    setQuery(mentionQueryAt(text, caret));
    setActive(0);
  };

  const pick = (user: MentionUser) => {
    if (!query) return;
    const caret = ref.current?.selectionStart ?? value.length;
    const insert = `@${user.name} `;
    const next = value.slice(0, query.start) + insert + value.slice(caret);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = query.start + insert.length;
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % matches.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(matches[active]!); }
    else if (e.key === "Escape") { e.preventDefault(); setQuery(null); }
  };

  const shared = {
    id,
    ref,
    value,
    placeholder,
    role: "combobox" as const,
    "aria-autocomplete": "list" as const,
    "aria-expanded": open,
    "aria-controls": listId,
    "aria-activedescendant": open ? `${listId}-${active}` : undefined,
    onKeyDown,
    onBlur: () => setTimeout(() => setQuery(null), 150),
    onChange: (e: { currentTarget: HTMLTextAreaElement | HTMLInputElement }) => update(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length),
  };

  return (
    <div className="relative min-w-0 flex-1">
      {multiline ? (
        <textarea {...shared} className={cn("w-full rounded-md border border-input bg-background px-3 py-2 text-sm", className)} />
      ) : (
        <input {...shared} className={cn("h-7 w-full rounded border border-input bg-background px-2 text-xs", className)} />
      )}
      {open && (
        <ul id={listId} role="listbox" aria-label={t.documents.comments.mentionList} className="absolute bottom-full left-0 z-20 mb-1 w-56 overflow-hidden rounded-md border bg-card py-1 text-sm shadow-md">
          {matches.map((user, i) => (
            <li
              key={user.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={cn("cursor-pointer px-3 py-1.5", i === active ? "bg-accent text-accent-foreground" : "hover:bg-muted")}
              onMouseDown={(e) => { e.preventDefault(); pick(user); }}
            >
              @{user.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Kommentartext mit farbig markierten Erwähnungen. */
export function CommentBody({ body, users, meId }: { body: string; users: MentionUser[]; meId?: string }) {
  return (
    <p className="whitespace-pre-wrap">
      {splitMentions(body, users).map((part, i) =>
        part.mention ? (
          <span key={i} data-mention={part.mention.id} className={cn("rounded px-0.5 font-medium text-primary", part.mention.id === meId ? "bg-primary/15" : "bg-accent")}>
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}
