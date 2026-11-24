import { z } from "zod";
import { t } from "@/i18n";
import { AuditAction, writeAudit } from "@/lib/domain/audit";
import type { Deps } from "@/lib/domain/deps";
import { exportTemplate } from "@/lib/domain/documents/export-template";
import { renderPdf } from "@/lib/domain/documents/pdf";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import { assert, hasApprovalRight, isCvd, type Actor } from "@/lib/domain/permissions";
import { loadPermissionContext } from "@/lib/domain/permissions/context";
import type { Report } from "@/lib/generated/prisma/client";
import { dateKey, formatDate } from "@/lib/time";
import { analyze, readTable, toRows, type ReportRow } from "./data";
import { buildReportHtml } from "./html";
import { buildSections, footnotes, type ReportMeta } from "./model";
import { buildExecutivePptx } from "./pptx";
import { REPORT_BLOCKS, TEMPLATES } from "./templates";
import { buildReportDocx } from "./word";

const MAX_FILE = 20 * 1024 * 1024;
const lines = z.array(z.string().trim().max(200)).max(200).transform((a) => [...new Set(a.filter(Boolean))]);

export const reportSchema = z
  .object({
    clientId: z.uuid(t.reports.errors.clientRequired),
    title: z.string().trim().max(200).nullish(),
    template: z.enum(["KOMPAKT", "MONATSBERICHT", "MANAGEMENT"]),
    periodStart: z.date(t.reports.errors.period),
    periodEnd: z.date(t.reports.errors.period),
    blocks: z.array(z.enum(REPORT_BLOCKS)).min(1, t.reports.errors.blocksRequired),
    clientAliases: lines,
    competitors: lines,
    tier1: lines,
    tier2: lines,
    excludePaid: z.boolean(),
    topicFilter: lines,
    commentary: z.string().trim().max(10_000).nullish(),
  })
  .refine((v) => v.periodStart <= v.periodEnd, { message: t.reports.errors.period, path: ["periodEnd"] });
export type ReportInput = z.input<typeof reportSchema>;
type UploadedFile = { name: string; mimeType: string; data: Uint8Array };

/** Vorbelegung für ein neues Reporting: letztes Reporting des Kunden, sonst Kundenprofil (Wettbewerber, Zielmedien). */
export async function reportDefaults(deps: Pick<Deps, "db">, clientId: string) {
  const last = await deps.db.report.findFirst({ where: { clientId }, orderBy: { createdAt: "desc" } });
  if (last) return { competitors: last.competitors, tier1: last.tier1, tier2: last.tier2, clientAliases: last.clientAliases, excludePaid: last.excludePaid, topicFilter: last.topicFilter };
  const sections = await deps.db.clientProfileSection.findMany({ where: { clientId, key: { in: ["wettbewerber", "zielmedien"] } } });
  const list = (key: string, field: string) => {
    const v = (sections.find((s) => s.key === key)?.content as Record<string, unknown> | undefined)?.[field];
    return Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : String((x as { text?: string }).text ?? ""))).filter(Boolean) : [];
  };
  return { competitors: list("wettbewerber", "wettbewerber"), tier1: list("zielmedien", "medien"), tier2: [] as string[], clientAliases: [] as string[], excludePaid: true, topicFilter: [] as string[] };
}

/** Export prüfen und ablegen: Dateityp, Größe, Pflichtspalten, mindestens eine Zeile. */
async function storeExport(deps: Deps, actor: Actor, file: UploadedFile) {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx")) throw new DomainError(t.reports.errors.fileType);
  if (file.data.byteLength > MAX_FILE) throw new DomainError(t.reports.errors.fileTooLarge);
  const table = await readTable(file.name, file.data).catch(() => {
    throw new DomainError(t.reports.errors.fileType);
  });
  const parsed = toRows(table);
  if (parsed.missing.length) throw new DomainError(t.reports.errors.columnsMissing(parsed.missing.map((f) => t.reports.errors.fieldNames[f] ?? f).join(", ")));
  if (!parsed.rows.length) throw new DomainError(t.reports.errors.noRows);
  const storageKey = `reports/${crypto.randomUUID()}`;
  await deps.files.put(storageKey, file.data, file.mimeType || "application/octet-stream");
  return deps.db.file.create({
    data: { storageKey, name: file.name, mimeType: file.mimeType || "application/octet-stream", size: file.data.byteLength, uploadedBy: actor.id, createdBy: actor.id },
  });
}

/** „Medienreporting Kunde · Oktober 2026“ bei einem ganzen Monat, sonst mit beiden Daten. */
function defaultTitle(clientName: string, start: Date, end: Date) {
  const [sk, ek] = [dateKey(start), dateKey(end)];
  const lastDay = new Date(Date.UTC(Number(ek.slice(0, 4)), Number(ek.slice(5, 7)), 0)).getUTCDate();
  const fullMonth = sk.slice(0, 7) === ek.slice(0, 7) && sk.endsWith("-01") && Number(ek.slice(8)) === lastDay;
  const label = fullMonth ? new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(start) : `${formatDate(start)} – ${formatDate(end)}`;
  return t.reports.form.titleDefault(clientName, label);
}

export async function createReport(deps: Deps, actor: Actor, raw: ReportInput, file: UploadedFile | null): Promise<Report> {
  assert(actor.active);
  const input = reportSchema.parse(raw);
  const client = await deps.db.client.findUnique({ where: { id: input.clientId } });
  if (!client || client.isInternal) throw new DomainError(t.reports.errors.clientRequired);
  if (!file || file.data.byteLength === 0) throw new DomainError(t.reports.errors.fileRequired);
  const stored = await storeExport(deps, actor, file);
  const { title, ...rest } = input;
  return deps.db.report.create({
    data: { ...rest, title: title || defaultTitle(client.name, input.periodStart, input.periodEnd), commentary: input.commentary || null, fileId: stored.id, createdBy: actor.id, updatedBy: actor.id },
  });
}

async function requireReport(deps: Pick<Deps, "db">, reportId: string) {
  const report = z.uuid().safeParse(reportId).success ? await deps.db.report.findUnique({ where: { id: reportId }, include: { client: true, file: true } }) : null;
  if (!report) throw new NotFoundError(t.errors.notFound);
  return report;
}

/** Einstellungen ändern, optional neuer Export. Eine Änderung nimmt eine Freigabe zurück. */
export async function updateReport(deps: Deps, actor: Actor, reportId: string, raw: ReportInput, file: UploadedFile | null): Promise<Report> {
  assert(actor.active);
  const report = await requireReport(deps, reportId);
  const input = reportSchema.parse({ ...raw, clientId: report.clientId });
  const stored = file && file.data.byteLength > 0 ? await storeExport(deps, actor, file) : null;
  const { title, clientId: _clientId, ...rest } = input;
  return deps.db.report.update({
    where: { id: reportId },
    data: {
      ...rest,
      title: title || report.title,
      commentary: input.commentary || null,
      ...(stored ? { fileId: stored.id } : {}),
      status: "ENTWURF",
      approvedBy: null,
      approvedAt: null,
      updatedBy: actor.id,
    },
  });
}

/** Vier Augen (Grundsatz 3): freigeben darf, wer Freigaberecht für den Kunden hat und das Reporting nicht erstellt hat. */
export async function canApproveReport(deps: Pick<Deps, "db">, actor: Actor, report: Pick<Report, "clientId" | "createdBy">) {
  if (!actor.active || actor.id === report.createdBy) return false;
  return hasApprovalRight(actor, await loadPermissionContext(deps.db, actor.id), report.clientId);
}

export async function approveReport(deps: Deps, actor: Actor, reportId: string, approve: boolean) {
  const report = await requireReport(deps, reportId);
  if (actor.id === report.createdBy) throw new DomainError(t.reports.errors.selfApproval);
  assert(await canApproveReport(deps, actor, report));
  await deps.db.report.update({
    where: { id: reportId },
    data: approve ? { status: "FREIGEGEBEN", approvedBy: actor.id, approvedAt: deps.now(), updatedBy: actor.id } : { status: "ENTWURF", approvedBy: null, approvedAt: null, updatedBy: actor.id },
  });
  await writeAudit(deps.db, { actorId: actor.id, action: approve ? AuditAction.REPORT_APPROVED : AuditAction.REPORT_REOPENED, entity: "Report", entityId: reportId });
}

/** Löschen: wer es erstellt hat oder ein CVD. Der Export wird mit gelöscht. */
export async function deleteReport(deps: Deps, actor: Actor, reportId: string) {
  const report = await requireReport(deps, reportId);
  assert(actor.active && (actor.id === report.createdBy || isCvd(actor)));
  await deps.db.report.delete({ where: { id: reportId } });
  if (report.file && !(await deps.db.report.count({ where: { fileId: report.file.id } }))) {
    await deps.db.file.delete({ where: { id: report.file.id } });
    await deps.files.delete(report.file.storageKey).catch(() => undefined);
  }
}

// ------------------------------------------------------------- Ausgabe

async function prepare(deps: Deps, reportId: string) {
  const report = await requireReport(deps, reportId);
  let rows: ReportRow[] = [];
  let stats = { rows: 0, skipped: 0 };
  if (report.file) {
    const data = await deps.files.get(report.file.storageKey).catch(() => null);
    if (data) {
      const parsed = toRows(await readTable(report.file.name, data));
      rows = parsed.rows;
      stats = { rows: parsed.rows.length, skipped: parsed.skipped };
    }
  }
  // ganzer letzter Tag zählt mit
  const periodEnd = new Date(report.periodEnd.getTime() + 86_399_999);
  const data = analyze(rows, {
    clientName: report.client.name,
    clientAliases: [report.client.shortName, ...report.clientAliases].filter((a) => a && a !== report.client.name),
    competitors: report.competitors,
    tier1: report.tier1,
    tier2: report.tier2,
    periodStart: report.periodStart,
    periodEnd,
    excludePaid: report.excludePaid,
    topicFilter: report.topicFilter,
  });
  const approver = report.approvedBy ? await deps.db.user.findUnique({ where: { id: report.approvedBy }, select: { name: true } }) : null;
  const meta: ReportMeta = {
    title: report.title,
    clientName: report.client.name,
    template: report.template,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    commentary: report.commentary,
    blocks: report.blocks,
    status: report.status,
    approvedByName: approver?.name ?? null,
    approvedAt: report.approvedAt,
    topicFilter: report.topicFilter,
  };
  const theme = await exportTemplate(deps, "RP", report.client);
  const accent = `#${theme.color}`;
  const emptyText = !report.file ? t.reports.doc.noFile : data.total === 0 ? t.reports.doc.empty : null;
  return { report, data, meta, theme, accent, emptyText, stats, sections: buildSections(meta, data, accent), notes: footnotes(meta, data) };
}

const fileBase = (r: { title: string }) => r.title.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "").slice(0, 80) || "Reporting";

export async function reportPreview(deps: Deps, reportId: string) {
  const p = await prepare(deps, reportId);
  const logoUrl = p.theme.logo ? `data:image/${p.theme.logo.type === "jpg" ? "jpeg" : "png"};base64,${Buffer.from(p.theme.logo.data).toString("base64")}` : null;
  return { html: buildReportHtml(p.meta, p.sections, p.notes, { accent: p.accent, font: p.theme.font, logoDataUrl: logoUrl }, p.emptyText), stats: p.stats, total: p.data.total };
}

export async function exportReport(deps: Deps, actor: Actor, reportId: string, kind: "pdf" | "docx" | "pptx") {
  assert(actor.active);
  const p = await prepare(deps, reportId);
  const name = fileBase(p.report);
  if (kind === "pptx") {
    return { data: await buildExecutivePptx(p.meta, p.data, { accent: p.accent, font: p.theme.font }), fileName: `${name}_Executive.pptx`, mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
  }
  if (kind === "docx") {
    const logo = p.theme.logo ? { data: p.theme.logo.data, type: p.theme.logo.type } : null;
    return { data: await buildReportDocx(p.meta, p.sections, p.notes, { accent: p.accent, font: p.theme.font, logo }, p.emptyText), fileName: `${name}.docx`, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }
  const logoUrl = p.theme.logo ? `data:image/${p.theme.logo.type === "jpg" ? "jpeg" : "png"};base64,${Buffer.from(p.theme.logo.data).toString("base64")}` : null;
  return { data: await renderPdf(buildReportHtml(p.meta, p.sections, p.notes, { accent: p.accent, font: p.theme.font, logoDataUrl: logoUrl }, p.emptyText)), fileName: `${name}.pdf`, mimeType: "application/pdf" };
}

export { TEMPLATES };
