import { z } from "zod";
import { t } from "@/i18n";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { assert, isCvd, type Actor } from "@/lib/domain/permissions";
import { CLIENT_FOLDERS, sanitize } from "./filing";

/**
 * Weitere Darstellungsformen (BRIEFING 7.3, 7.10): Name, Bausteine mit Pflichtangabe,
 * Strukturregeln als Text für die KI und SharePoint-Ordner. Nur CVDs; eingebaute Formen bleiben fest.
 */
export const formatSchema = z.object({
  name: z.string().trim().min(1, t.formats.errors.nameRequired).max(80),
  /** eine Zeile pro Baustein; "*" am Ende markiert Pflicht */
  blocks: z.string().trim().min(1, t.formats.errors.blocksRequired),
  rulesText: z.string().trim().max(2000).nullish().transform((v) => v || null),
  sharePointFolder: z.enum(CLIENT_FOLDERS.filter((f) => !f.startsWith("99")) as [string, ...string[]]),
});

export function parseBlockLines(text: string) {
  const blocks = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const required = line.endsWith("*");
      const label = line.replace(/\*$/, "").trim();
      return { key: sanitize(label).toLowerCase(), label, required };
    });
  const keys = blocks.map((b) => b.key);
  if (keys.some((k) => !k) || new Set(keys).size !== keys.length) throw new DomainError(t.formats.errors.blocksInvalid);
  return blocks;
}

export async function createFormat(deps: Deps, actor: Actor, raw: z.input<typeof formatSchema>) {
  assert(isCvd(actor));
  const input = formatSchema.parse(raw);
  const key = sanitize(input.name).toUpperCase();
  if (!key || (await deps.db.documentFormat.findUnique({ where: { key } }))) throw new DomainError(t.formats.errors.nameTaken);
  const count = await deps.db.documentFormat.count();
  return deps.db.documentFormat.create({
    data: {
      key,
      name: input.name,
      blocks: parseBlockLines(input.blocks),
      rulesText: input.rulesText,
      sharePointFolder: input.sharePointFolder,
      builtIn: false,
      sortOrder: count + 1,
      createdBy: actor.id,
      updatedBy: actor.id,
    },
  });
}

/** Eigene Formen ändern; Bausteine nur, solange noch kein Dokument die Form nutzt. */
export async function updateFormat(deps: Deps, actor: Actor, id: string, raw: z.input<typeof formatSchema>) {
  assert(isCvd(actor));
  const format = await deps.db.documentFormat.findUnique({ where: { id }, include: { _count: { select: { documents: true } } } });
  if (!format) throw new NotFoundError(t.errors.notFound);
  if (format.builtIn) throw new DomainError(t.formats.errors.builtIn);
  const input = formatSchema.parse(raw);
  const blocks = parseBlockLines(input.blocks);
  if (format._count.documents > 0 && JSON.stringify(blocks) !== JSON.stringify(format.blocks)) throw new DomainError(t.formats.errors.inUse);
  return deps.db.documentFormat.update({
    where: { id },
    data: { name: input.name, blocks, rulesText: input.rulesText, sharePointFolder: input.sharePointFolder, updatedBy: actor.id },
  });
}
