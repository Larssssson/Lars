import type { FileStorage } from "../lib/adapters";
import type { Prisma, PrismaClient } from "../lib/generated/prisma/client";

/**
 * Entfernt alle Beispieldaten (isSampleData = true), Nutzer und Konfiguration bleiben
 * (BRIEFING 13, Phase 6). Reihenfolge: abhängige Tabellen zuerst. Mit `files` werden auch die
 * gespeicherten Beispieldateien (Logos, Unterlagen) aus dem Dateispeicher gelöscht.
 */
export async function clearSamples(client: PrismaClient, files?: FileStorage): Promise<Record<string, number>> {
  const keys = (await client.file.findMany({ where: { isSampleData: true }, select: { storageKey: true } })).map((f) => f.storageKey);
  const result = await client.$transaction(async (tx) => clearSamplesIn(tx), { timeout: 60_000 });
  if (files) for (const key of keys) await files.delete(key).catch(() => undefined);
  return result;
}

async function clearSamplesIn(db: Prisma.TransactionClient): Promise<Record<string, number>> {
  const where = { isSampleData: true };
  const steps: [string, () => Promise<{ count: number }>][] = [
    ["AuditLog", () => db.auditLog.deleteMany({ where })],
    ["Notification", () => db.notification.deleteMany({ where })],
    ["ArticleAction", () => db.articleAction.deleteMany({ where })],
    ["ArticleRelevance", () => db.articleRelevance.deleteMany({ where })],
    ["Article", () => db.article.deleteMany({ where })],
    ["MonitoringImport", () => db.monitoringImport.deleteMany({ where })],
    ["ImportMapping", () => db.importMapping.deleteMany({ where })],
    ["RevealLog", () => db.revealLog.deleteMany({ where })],
    ["ContactAccessGrant", () => db.contactAccessGrant.deleteMany({ where })],
    ["ContactRequest", () => db.contactRequest.deleteMany({ where })],
    ["ContactBookmark", () => db.contactBookmark.deleteMany({ where })],
    ["ContactOwner", () => db.contactOwner.deleteMany({ where })],
    ["ContactDetail", () => db.contactDetail.deleteMany({ where })],
    ["Journalist", () => db.journalist.deleteMany({ where })],
    ["Media", () => db.media.deleteMany({ where })],
    ["Finding", () => db.finding.deleteMany({ where })],
    ["Approval", () => db.approval.deleteMany({ where })],
    ["CheckRun", () => db.checkRun.deleteMany({ where })],
    ["DismissalRule", () => db.dismissalRule.deleteMany({ where })],
    ["AiInsertion", () => db.aiInsertion.deleteMany({ where })],
    ["Dispatch", () => db.dispatch.deleteMany({ where })],
    ["Comment", () => db.comment.deleteMany({ where })],
    ["ProfileSuggestion", () => db.profileSuggestion.deleteMany({ where })],
    ["Document", () => db.document.deleteMany({ where })],
    ["DocumentVersion", () => db.documentVersion.deleteMany({ where })],
    ["Task", () => db.task.deleteMany({ where })],
    ["Project", () => db.project.deleteMany({ where })],
    ["Kpi", () => db.kpi.deleteMany({ where })],
    ["AgreedService", () => db.agreedService.deleteMany({ where })],
    ["Speaker", () => db.speaker.deleteMany({ where })],
    ["ClientProfileSection", () => db.clientProfileSection.deleteMany({ where })],
    ["PermissionGrant", () => db.permissionGrant.deleteMany({ where })],
    ["ClientMember", () => db.clientMember.deleteMany({ where })],
    ["Shift", () => db.shift.deleteMany({ where })],
    ["Client", () => db.client.deleteMany({ where })],
    ["File", () => db.file.deleteMany({ where })],
    ["ShiftType", () => db.shiftType.deleteMany({ where })],
    ["DocumentFormat", () => db.documentFormat.deleteMany({ where })],
    ["Setting", () => db.setting.deleteMany({ where })],
    ["PushSubscription", () => db.pushSubscription.deleteMany({ where })],
    ["UserActivity", () => db.userActivity.deleteMany({ where })],
  ];
  const result: Record<string, number> = {};
  for (const [name, step] of steps) result[name] = (await step()).count;
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await import("dotenv/config");
  const { createPrismaClient } = await import("../lib/db");
  const { adapters } = await import("../lib/adapters");
  const db = createPrismaClient();
  try {
    const result = await clearSamples(db, adapters.fileStorage());
    const total = Object.values(result).reduce((sum, n) => sum + n, 0);
    console.info(`Beispieldaten entfernt: ${total} Datensätze. Nutzer bleiben erhalten.`);
  } finally {
    await db.$disconnect();
  }
}
