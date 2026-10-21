import { t } from "@/i18n";
import type { BlockText } from "@/lib/editor/content";

/**
 * Regelbasierte Strukturprüfung ohne KI (BRIEFING 7.4): Bausteine und Regeln der Darstellungsform.
 * Läuft im Reiter Prüfung und fortlaufend beim Schreiben (Live-Hinweise); daher ohne Server-Abhängigkeiten.
 */
export type FormatRules = {
  minChars?: number;
  maxChars?: number;
  firstQuoteWithinChars?: number;
  requiresNumber?: boolean;
  leadAnswersWQuestions?: boolean;
  speakerInSpeakerList?: boolean;
  everyQuestionAnswered?: boolean;
};

export type Anchor = { blockKey: string; quote?: string } | { wholeText: true };

export type StructureFinding = {
  category: "STRUKTUR";
  severity: "KRITISCH" | "WICHTIG" | "HINWEIS";
  confidence: "HOCH" | "MITTEL" | "NIEDRIG";
  anchor: Anchor;
  message: string;
  reason: string;
};

export type Strictness = "STRENG" | "NORMAL" | "LOCKER";

const s = t.checks.structure;
const QUOTE_MARK = /[„“”"»«]/;
/** Bausteine, die für Zahl und Zitat nicht zählen (Rahmen statt Inhalt). */
const FRAME_BLOCKS = new Set(["ortsmarke", "boilerplate", "pressekontakt", "sperrfrist"]);
const MONTHS = "Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember";
const WHEN = new RegExp(
  `\\b(heute|morgen|gestern|künftig|ab sofort|derzeit|aktuell|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|${MONTHS}|Quartal|Halbjahr|Jahr|Jahres|Woche|Monat|Frühjahr|Sommer|Herbst|Winter)\\b|\\b\\d{1,2}\\.\\s?\\d{1,2}\\.|\\b(19|20)\\d{2}\\b`,
  "i",
);
const WHERE = /\b(in|im|nach|bei|aus|am Standort|vor Ort)\s+[A-ZÄÖÜ]/;

const chars = (text: string) => text.replace(/\n/g, "").length;

export function structureFindings(input: {
  blocks: BlockText[];
  rules: FormatRules;
  speakers?: string[];
  strictness?: Strictness;
}): StructureFinding[] {
  const { blocks, rules } = input;
  const findings: StructureFinding[] = [];
  const add = (f: Omit<StructureFinding, "category">) => findings.push({ category: "STRUKTUR", ...f });
  const total = blocks.reduce((sum, b) => sum + chars(b.text), 0);
  const block = (key: string) => blocks.find((b) => b.key === key);

  for (const b of blocks) {
    if (b.required && !b.text.trim()) {
      add({ severity: "WICHTIG", confidence: "HOCH", anchor: { blockKey: b.key }, message: s.blockMissing(b.label), reason: s.blockReason });
    }
  }

  // Länge erst prüfen, wenn überhaupt geschrieben wurde
  if (rules.minChars && total > 0 && total < rules.minChars) {
    add({ severity: "HINWEIS", confidence: "HOCH", anchor: { wholeText: true }, message: s.tooShort(total, rules.minChars), reason: s.lengthReason });
  }
  if (rules.maxChars && total > rules.maxChars) {
    add({ severity: "WICHTIG", confidence: "HOCH", anchor: { wholeText: true }, message: s.tooLong(total, rules.maxChars), reason: s.lengthReason });
  }

  if (rules.firstQuoteWithinChars) {
    const limit = rules.firstQuoteWithinChars;
    let position = 0;
    let found: number | null = null;
    for (const b of blocks) {
      if (FRAME_BLOCKS.has(b.key)) continue;
      const text = b.text.replace(/\n/g, "");
      if (b.key === "zitat" && text.trim()) {
        found = position;
        break;
      }
      const index = text.search(QUOTE_MARK);
      if (index >= 0) {
        found = position + index;
        break;
      }
      position += text.length;
    }
    const contentChars = position;
    if ((found === null && contentChars > limit) || (found !== null && found > limit)) {
      add({ severity: "HINWEIS", confidence: "HOCH", anchor: block("zitat") ? { blockKey: "zitat" } : { wholeText: true }, message: s.noQuoteEarly(limit), reason: s.noQuoteReason });
    }
  }

  if (rules.requiresNumber) {
    const content = blocks.filter((b) => !FRAME_BLOCKS.has(b.key)).map((b) => b.text).join(" ");
    if (content.trim() && !/\d/.test(content)) {
      add({ severity: "WICHTIG", confidence: "HOCH", anchor: { wholeText: true }, message: s.noNumber, reason: s.noNumberReason });
    }
  }

  if (rules.leadAnswersWQuestions) {
    const lead = block("lead")?.text.trim();
    if (lead) {
      if (!WHEN.test(lead)) add({ severity: "HINWEIS", confidence: "NIEDRIG", anchor: { blockKey: "lead" }, message: s.leadWhen, reason: s.leadReason });
      const place = block("ortsmarke")?.text.split(/[,\n]/)[0]?.trim();
      const namesPlace = place && place.length > 1 && lead.toLowerCase().includes(place.toLowerCase());
      if (!namesPlace && !WHERE.test(lead)) add({ severity: "HINWEIS", confidence: "NIEDRIG", anchor: { blockKey: "lead" }, message: s.leadWhere, reason: s.leadReason });
    }
  }

  if (rules.speakerInSpeakerList && input.speakers) {
    const speaker = block("sprecher")?.text.trim();
    const known = input.speakers.map((n) => n.replace(/^\[Beispiel\]\s*/, "").toLowerCase());
    if (speaker && !known.some((name) => speaker.toLowerCase().includes(name))) {
      add({ severity: "WICHTIG", confidence: "HOCH", anchor: { blockKey: "sprecher", quote: speaker.split("\n")[0] }, message: s.speakerUnknown, reason: s.speakerReason });
    }
  }

  if (rules.everyQuestionAnswered) {
    const lines = (block("fragen")?.text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    lines.forEach((line, i) => {
      const next = lines[i + 1];
      if (line.endsWith("?") && (!next || next.endsWith("?"))) {
        add({ severity: "WICHTIG", confidence: "HOCH", anchor: { blockKey: "fragen", quote: line }, message: s.questionUnanswered(line), reason: s.questionReason });
      }
    });
  }

  // Strenge locker: nur deutliche Abweichungen (DECISIONS D-070)
  return input.strictness === "LOCKER" ? findings.filter((f) => f.severity !== "HINWEIS") : findings;
}
