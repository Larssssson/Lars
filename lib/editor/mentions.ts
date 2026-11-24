/**
 * @-Erwähnungen in Kommentaren (DECISIONS D-127). Eine Erwähnung ist „@“ plus voller Name oder Vorname,
 * danach kein weiterer Buchstabe. Ohne Server- und DOM-Abhängigkeiten, im Browser und auf dem Server nutzbar.
 */
export type MentionUser = { id: string; name: string };

const NOT_LETTER = /[^\p{L}\p{N}_-]/u;

function variants(user: MentionUser): string[] {
  const full = user.name.trim();
  const first = full.split(/\s+/)[0]!;
  return first === full ? [full] : [full, first];
}

/** Stellen im Text: Start (beim @), Länge und Person. Längere Namen zuerst, damit „@Lars Scholtyssyk“ nicht als „@Lars“ zählt. */
export function findMentionRanges(body: string, users: MentionUser[]): { start: number; length: number; user: MentionUser }[] {
  const candidates = users.flatMap((user) => variants(user).map((name) => ({ name, user }))).sort((a, b) => b.name.length - a.name.length);
  const lower = body.toLowerCase();
  const ranges: { start: number; length: number; user: MentionUser }[] = [];
  for (let i = lower.indexOf("@"); i !== -1; i = lower.indexOf("@", i + 1)) {
    if (i > 0 && !NOT_LETTER.test(body[i - 1]!)) continue; // mitten in einer Mailadresse
    const hit = candidates.find(({ name }) => {
      if (!lower.startsWith(name.toLowerCase(), i + 1)) return false;
      const next = body[i + 1 + name.length];
      return next === undefined || NOT_LETTER.test(next);
    });
    if (hit) ranges.push({ start: i, length: hit.name.length + 1, user: hit.user });
  }
  return ranges;
}

/** Erwähnte Personen, jede nur einmal. */
export function mentionedUsers<T extends MentionUser>(body: string, users: T[]): T[] {
  const ids = new Set(findMentionRanges(body, users).map((r) => r.user.id));
  return users.filter((u) => ids.has(u.id));
}

/** Text in Abschnitte zerlegen, damit die Oberfläche Erwähnungen farbig zeigen kann. */
export function splitMentions(body: string, users: MentionUser[]): { text: string; mention?: MentionUser }[] {
  const parts: { text: string; mention?: MentionUser }[] = [];
  let at = 0;
  for (const r of findMentionRanges(body, users)) {
    if (r.start > at) parts.push({ text: body.slice(at, r.start) });
    parts.push({ text: body.slice(r.start, r.start + r.length), mention: r.user });
    at = r.start + r.length;
  }
  if (at < body.length) parts.push({ text: body.slice(at) });
  return parts;
}

/** Offene Erwähnung direkt vor dem Cursor („@La“), für die Vorschlagsliste. */
export function mentionQueryAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const match = /(^|[^\p{L}\p{N}_])@([\p{L}-]{0,30})$/u.exec(before);
  if (!match) return null;
  return { start: caret - match[2]!.length - 1, query: match[2]! };
}
