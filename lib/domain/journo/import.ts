import ICAL from "ical.js";
import { z } from "zod";
import { t } from "@/i18n";
import type { Deps } from "@/lib/domain/deps";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { parseCsvText, parseXlsxData } from "@/lib/files/tabular";
import { assert, canEditContact, type Actor } from "@/lib/domain/permissions";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { mediaByName, normalizeMail, normalizePhone } from "./contacts";

/**
 * Kontaktimport (BRIEFING 7.5): Datei hochladen, Spalten zuordnen (speicherbar), Vorschau mit
 * Dubletten, übernehmen. Formate CSV, XLSX und vCard.
 */
export const IMPORT_FIELDS = ["firstName", "lastName", "fullName", "media", "desk", "function", "email", "phone", "phone2", "notes", "topics", "region"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type Mapping = Record<string, ImportField | "">;

export type ParsedFile = { kind: "CSV" | "XLSX" | "VCF"; columns: string[]; rows: Record<string, string>[] };

const MAX_ROWS = 5000;

/** vCard-Felder als feste Spalten (N, FN, ORG, TITLE, EMAIL, TEL, NOTE). */
const VCF_COLUMNS = ["Vorname", "Nachname", "Name", "Medium", "Funktion", "E-Mail", "Telefon", "Telefon 2", "Notiz"];

export function fileKind(name: string): ParsedFile["kind"] | null {
  const ext = name.toLowerCase().split(".").pop();
  return ext === "csv" ? "CSV" : ext === "xlsx" ? "XLSX" : ext === "vcf" ? "VCF" : null;
}

function parseVcf(text: string): Omit<ParsedFile, "kind"> {
  const parsed = ICAL.parse(text) as unknown[];
  const cards = (Array.isArray(parsed[0]) ? parsed : [parsed]) as ConstructorParameters<typeof ICAL.Component>[0][];
  const rows = cards.map((jcard) => {
    const card = new ICAL.Component(jcard);
    const n = (card.getFirstPropertyValue("n") as string[] | null) ?? [];
    const org = card.getFirstPropertyValue("org") as string[] | string | null;
    const tels = card.getAllProperties("tel").map((p) => String(p.getFirstValue() ?? ""));
    // Textfelder können durch unmaskierte Kommas in mehrere Werte zerfallen; wieder zusammensetzen
    const value = (name: string) => (card.getFirstProperty(name)?.getValues() ?? []).map(String).join(",");
    return {
      Vorname: n[1] ?? "",
      Nachname: n[0] ?? "",
      Name: value("fn"),
      Medium: Array.isArray(org) ? (org[0] ?? "") : (org ?? ""),
      Funktion: value("title"),
      "E-Mail": value("email"),
      Telefon: tels[0] ?? "",
      "Telefon 2": tels[1] ?? "",
      Notiz: value("note"),
    };
  });
  return { columns: VCF_COLUMNS, rows };
}

export async function parseContactFile(file: { name: string; data: Uint8Array }): Promise<ParsedFile> {
  const kind = fileKind(file.name);
  if (!kind) throw new DomainError(t.journo.errors.fileType);
  const text = () => new TextDecoder("utf-8").decode(file.data);
  let parsed: Omit<ParsedFile, "kind">;
  try {
    parsed = kind === "CSV" ? parseCsvText(text()) : kind === "XLSX" ? await parseXlsxData(file.data) : parseVcf(text());
  } catch {
    throw new DomainError(t.journo.errors.fileType);
  }
  return { kind, columns: parsed.columns, rows: parsed.rows.slice(0, MAX_ROWS) };
}

const GUESSES: [RegExp, ImportField][] = [
  [/^(vorname|first ?name|given)/i, "firstName"],
  [/^(nachname|last ?name|surname|family)/i, "lastName"],
  [/^(name|full ?name|anzeigename)$/i, "fullName"],
  [/^(medium|medien|media|outlet|organisation|org|firma|unternehmen|company)/i, "media"],
  [/^(ressort|desk|abteilung|section)/i, "desk"],
  [/^(funktion|position|titel|title|rolle)/i, "function"],
  [/^(e-?mail|mail)/i, "email"],
  [/^(telefon 2|phone 2|mobil|handy|mobile)/i, "phone2"],
  [/^(telefon|phone|tel)/i, "phone"],
  [/^(notiz|notes?|bemerkung|kommentar)/i, "notes"],
  [/^(themen|topics|schwerpunkt)/i, "topics"],
  [/^(region|ort|stadt|city)/i, "region"],
];

/** Vorschlag für die Zuordnung aus den Spaltennamen. */
export function guessMapping(columns: string[]): Mapping {
  const used = new Set<ImportField>();
  const mapping: Mapping = {};
  for (const column of columns) {
    const field = GUESSES.find(([re, f]) => re.test(column.trim()) && !used.has(f))?.[1];
    mapping[column] = field ?? "";
    if (field) used.add(field);
  }
  return mapping;
}

export type ImportRow = {
  index: number;
  firstName: string;
  lastName: string;
  media: string;
  desk: string;
  function: string;
  email: string | null;
  phones: string[];
  notes: string;
  topics: string[];
  region: string;
  problems: ("NO_NAME" | "NO_MAIL" | "PHONE_INVALID")[];
  duplicate: { kind: "EXISTING"; journalistId: string; name: string; reason: "MAIL" | "TELEFON" | "NAME_MEDIUM" } | { kind: "IN_FILE"; row: number; reason: "MAIL" | "TELEFON" | "NAME_MEDIUM" } | null;
};

function mapRow(record: Record<string, string>, mapping: Mapping, index: number): ImportRow {
  const get = (field: ImportField) =>
    Object.entries(mapping)
      .filter(([, f]) => f === field)
      .map(([column]) => (record[column] ?? "").trim())
      .filter(Boolean)
      .join(" ");
  let firstName = get("firstName");
  let lastName = get("lastName");
  const full = get("fullName");
  if ((!firstName || !lastName) && full) {
    const parts = full.split(/\s+/);
    lastName ||= parts.length > 1 ? parts.pop()! : "";
    firstName ||= parts.join(" ");
  }
  const problems: ImportRow["problems"] = [];
  if (!firstName || !lastName) problems.push("NO_NAME");
  const mail = get("email") ? normalizeMail(get("email")) : null;
  const email = mail && z.email().safeParse(mail).success ? mail : null;
  if (!email) problems.push("NO_MAIL");
  const rawPhones = [get("phone"), get("phone2")].filter(Boolean);
  const phones = rawPhones.map(normalizePhone).filter((p): p is string => Boolean(p));
  if (phones.length < rawPhones.length) problems.push("PHONE_INVALID");
  return {
    index,
    firstName,
    lastName,
    media: get("media"),
    desk: get("desk"),
    function: get("function"),
    email,
    phones,
    notes: get("notes"),
    topics: get("topics").split(/[,;]/).map((x) => x.trim()).filter(Boolean),
    region: get("region"),
    problems,
    duplicate: null,
  };
}

const nameKey = (first: string, last: string, media: string) => `${first} ${last}|${media}`.toLowerCase().replace(/\s+/g, " ").trim();

/** Dubletten: gleiche Mail, gleiche Telefonnummer (E.164) oder gleicher Name plus Medium (BRIEFING 7.5). */
export async function detectDuplicates(db: PrismaClient, rows: ImportRow[]): Promise<ImportRow[]> {
  const contacts = await db.journalist.findMany({ include: { contactDetails: true, media: { select: { name: true } } } });
  const byMail = new Map<string, (typeof contacts)[number]>();
  const byPhone = new Map<string, (typeof contacts)[number]>();
  const byName = new Map<string, (typeof contacts)[number]>();
  for (const c of contacts) {
    for (const d of c.contactDetails) {
      if (d.kind === "MAIL") byMail.set(d.value.toLowerCase(), c);
      if (d.kind === "TELEFON") byPhone.set(d.value, c);
    }
    if (c.media) byName.set(nameKey(c.firstName, c.lastName, c.media.name), c);
  }
  const seen = { mail: new Map<string, number>(), phone: new Map<string, number>(), name: new Map<string, number>() };
  return rows.map((row) => {
    const key = row.media ? nameKey(row.firstName, row.lastName, row.media) : null;
    const existing =
      (row.email && byMail.get(row.email) && { c: byMail.get(row.email)!, reason: "MAIL" as const }) ||
      (row.phones.map((p) => byPhone.get(p)).find(Boolean) && { c: row.phones.map((p) => byPhone.get(p)).find(Boolean)!, reason: "TELEFON" as const }) ||
      (key && byName.get(key) && { c: byName.get(key)!, reason: "NAME_MEDIUM" as const }) ||
      null;
    let duplicate: ImportRow["duplicate"] = existing
      ? { kind: "EXISTING", journalistId: existing.c.id, name: `${existing.c.firstName} ${existing.c.lastName}`, reason: existing.reason }
      : null;
    if (!duplicate) {
      const inFile =
        (row.email && seen.mail.has(row.email) && { row: seen.mail.get(row.email)!, reason: "MAIL" as const }) ||
        (row.phones.find((p) => seen.phone.has(p)) && { row: seen.phone.get(row.phones.find((p) => seen.phone.has(p))!)!, reason: "TELEFON" as const }) ||
        (key && seen.name.has(key) && { row: seen.name.get(key)!, reason: "NAME_MEDIUM" as const }) ||
        null;
      if (inFile) duplicate = { kind: "IN_FILE", row: inFile.row, reason: inFile.reason };
    }
    if (row.email && !seen.mail.has(row.email)) seen.mail.set(row.email, row.index);
    row.phones.forEach((p) => !seen.phone.has(p) && seen.phone.set(p, row.index));
    if (key && !seen.name.has(key)) seen.name.set(key, row.index);
    return { ...row, duplicate };
  });
}

// ------------------------------------------------------------- Ablauf mit hochgeladener Datei

/** Schritt 1: Datei ablegen; die folgenden Schritte lesen sie erneut (nur die hochladende Person). */
export async function uploadContactFile(deps: Deps, actor: Actor, file: { name: string; mimeType: string; data: Uint8Array }) {
  assert(canEditContact(actor));
  const parsed = await parseContactFile(file);
  if (!parsed.rows.length) throw new DomainError(t.journo.import.noRows);
  const storageKey = `imports/kontakte/${crypto.randomUUID()}`;
  await deps.files.put(storageKey, file.data, file.mimeType || "application/octet-stream");
  return deps.db.file.create({
    data: { storageKey, name: file.name, mimeType: file.mimeType || "application/octet-stream", size: file.data.byteLength, uploadedBy: actor.id, createdBy: actor.id },
  });
}

export async function loadImportFile(deps: Deps, actor: Actor, fileId: string) {
  if (!z.uuid().safeParse(fileId).success) throw new NotFoundError(t.journo.errors.fileMissing);
  const file = await deps.db.file.findUnique({ where: { id: fileId } });
  if (!file || file.uploadedBy !== actor.id || !file.storageKey.startsWith("imports/kontakte/")) throw new NotFoundError(t.journo.errors.fileMissing);
  const data = await deps.files.get(file.storageKey).catch(() => null);
  if (!data) throw new NotFoundError(t.journo.errors.fileMissing);
  return { file, parsed: await parseContactFile({ name: file.name, data }) };
}

function checkMapping(mapping: Mapping) {
  const fields = new Set(Object.values(mapping));
  if (!(fields.has("fullName") || (fields.has("firstName") && fields.has("lastName")))) throw new DomainError(t.journo.errors.mappingName);
}

/** Schritt 3: Vorschau mit Problemen und Dubletten. */
export async function previewContactImport(deps: Deps, actor: Actor, fileId: string, mapping: Mapping) {
  assert(canEditContact(actor));
  checkMapping(mapping);
  const { parsed } = await loadImportFile(deps, actor, fileId);
  return detectDuplicates(deps.db, parsed.rows.map((r, i) => mapRow(r, mapping, i + 1)));
}

export type ImportDecision = "MERGE" | "SKIP" | "NEW";

/** Vorgabe in der Vorschau: Dubletten zum Bestand zusammenführen, Dubletten in der Datei überspringen. */
export function defaultDecision(row: ImportRow): ImportDecision {
  if (row.problems.includes("NO_NAME")) return "SKIP";
  if (!row.duplicate) return "NEW";
  return row.duplicate.kind === "EXISTING" ? "MERGE" : "SKIP";
}

type Tx = Prisma.TransactionClient;

async function addDetails(tx: Tx, journalistId: string, row: ImportRow, actorId: string) {
  const existing = await tx.contactDetail.findMany({ where: { journalistId } });
  const values = [...(row.email ? [{ kind: "MAIL" as const, value: row.email }] : []), ...row.phones.map((value) => ({ kind: "TELEFON" as const, value }))];
  for (const v of values) {
    if (existing.some((d) => d.kind === v.kind && d.value === v.value)) continue;
    const isPrimary = !existing.some((d) => d.kind === v.kind && d.isPrimary);
    existing.push(await tx.contactDetail.create({ data: { journalistId, kind: v.kind, value: v.value, isPrimary, createdBy: actorId, updatedBy: actorId } }));
  }
}

/**
 * Schritt 4: übernehmen. Neue Kontakte bekommen das Label Import, die importierende Person wird
 * Owner. Zusammenführen ergänzt leere Felder und fehlende Kontaktdaten, überschreibt nichts (DECISIONS D-091).
 */
export async function commitContactImport(
  deps: Deps,
  actor: Actor,
  input: { fileId: string; mapping: Mapping; decisions: Record<number, ImportDecision>; mappingName?: string | null },
) {
  const rows = await previewContactImport(deps, actor, input.fileId, input.mapping);
  const { file } = await loadImportFile(deps, actor, input.fileId);
  const now = deps.now();
  const counts = { created: 0, merged: 0, skipped: 0 };
  await deps.db.$transaction(
    async (tx) => {
      for (const row of rows) {
        const decision = input.decisions[row.index] ?? defaultDecision(row);
        if (decision === "SKIP" || row.problems.includes("NO_NAME") || (decision === "MERGE" && row.duplicate?.kind !== "EXISTING")) {
          counts.skipped += 1;
          continue;
        }
        const mediaId = row.media ? await mediaByName(tx, row.media, actor.id) : null;
        if (decision === "MERGE" && row.duplicate?.kind === "EXISTING") {
          const current = await tx.journalist.findUniqueOrThrow({ where: { id: row.duplicate.journalistId } });
          await tx.journalist.update({
            where: { id: current.id },
            data: {
              mediaId: current.mediaId ?? mediaId,
              desk: current.desk || row.desk || null,
              function: current.function || row.function || null,
              region: current.region || row.region || null,
              topics: [...new Set([...current.topics, ...row.topics])],
              notes: [current.notes, row.notes].filter(Boolean).join("\n") || null,
              lastActivityAt: now,
              updatedBy: actor.id,
            },
          });
          await addDetails(tx, current.id, row, actor.id);
          counts.merged += 1;
          continue;
        }
        const contact = await tx.journalist.create({
          data: {
            firstName: row.firstName,
            lastName: row.lastName,
            mediaId,
            desk: row.desk || null,
            function: row.function || null,
            topics: row.topics,
            region: row.region || null,
            notes: row.notes || null,
            status: "IMPORT",
            source: "IMPORT",
            lastActivityAt: now,
            createdBy: actor.id,
            updatedBy: actor.id,
          },
        });
        await addDetails(tx, contact.id, row, actor.id);
        await tx.contactOwner.create({ data: { journalistId: contact.id, userId: actor.id, since: now, createdBy: actor.id, updatedBy: actor.id } });
        counts.created += 1;
      }
      if (input.mappingName?.trim()) {
        await tx.importMapping.create({ data: { name: input.mappingName.trim().slice(0, 80), kind: "KONTAKTE", mapping: input.mapping, createdBy: actor.id, updatedBy: actor.id } });
      }
    },
    { timeout: 120_000 },
  );
  // die Datei wird nach dem Import nicht mehr gebraucht (so wenig Daten wie nötig)
  await deps.files.delete(file.storageKey).catch(() => undefined);
  await deps.db.file.delete({ where: { id: file.id } });
  return counts;
}
