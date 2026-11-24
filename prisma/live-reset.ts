import type { PrismaClient } from "../lib/generated/prisma/client";

/**
 * Einmaliges Leeren für den Live-Test (DECISIONS D-131): alle Inhalte weg, egal ob Beispiel oder im Test angelegt.
 * Bleiben: Nutzer, Diensttypen, Darstellungsformen, Einstellungen, Push-Geräte, der interne Kunde und das
 * unveränderliche Protokoll. Gemerkt in der Einstellung `live.resetAt`, damit ein Neustart nichts mehr löscht.
 */
export const LIVE_RESET_KEY = "live.resetAt";

export async function liveResetOnce(db: PrismaClient, now = new Date()): Promise<Record<string, number> | null> {
  if (await db.setting.findUnique({ where: { key: LIVE_RESET_KEY } })) return null;
  const result: Record<string, number> = {};
  await db.$transaction(
    async (tx) => {
      const all = {};
      const steps: [string, () => Promise<{ count: number }>][] = [
        ["Notification", () => tx.notification.deleteMany(all)],
        ["ArticleAction", () => tx.articleAction.deleteMany(all)],
        ["ArticleRelevance", () => tx.articleRelevance.deleteMany(all)],
        ["Article", () => tx.article.deleteMany(all)],
        ["MonitoringImport", () => tx.monitoringImport.deleteMany(all)],
        ["ImportMapping", () => tx.importMapping.deleteMany(all)],
        ["RevealLog", () => tx.revealLog.deleteMany(all)],
        ["ContactAccessGrant", () => tx.contactAccessGrant.deleteMany(all)],
        ["ContactRequest", () => tx.contactRequest.deleteMany(all)],
        ["ContactBookmark", () => tx.contactBookmark.deleteMany(all)],
        ["ContactOwner", () => tx.contactOwner.deleteMany(all)],
        ["ContactDetail", () => tx.contactDetail.deleteMany(all)],
        ["Journalist", () => tx.journalist.deleteMany(all)],
        ["Media", () => tx.media.deleteMany(all)],
        ["Finding", () => tx.finding.deleteMany(all)],
        ["Approval", () => tx.approval.deleteMany(all)],
        ["CheckRun", () => tx.checkRun.deleteMany(all)],
        ["DismissalRule", () => tx.dismissalRule.deleteMany(all)],
        ["AiInsertion", () => tx.aiInsertion.deleteMany(all)],
        ["Dispatch", () => tx.dispatch.deleteMany(all)],
        ["Comment", () => tx.comment.deleteMany(all)],
        ["ProfileSuggestion", () => tx.profileSuggestion.deleteMany(all)],
        ["Document", () => tx.document.deleteMany(all)],
        ["DocumentVersion", () => tx.documentVersion.deleteMany(all)],
        ["Task", () => tx.task.deleteMany(all)],
        ["Project", () => tx.project.deleteMany(all)],
        ["Kpi", () => tx.kpi.deleteMany(all)],
        ["AgreedService", () => tx.agreedService.deleteMany(all)],
        ["Speaker", () => tx.speaker.deleteMany(all)],
        ["ClientProfileSection", () => tx.clientProfileSection.deleteMany(all)],
        ["PermissionGrant", () => tx.permissionGrant.deleteMany(all)],
        ["ClientMember", () => tx.clientMember.deleteMany(all)],
        ["Shift", () => tx.shift.deleteMany(all)],
        ["UserActivity", () => tx.userActivity.deleteMany(all)],
        ["UserSelection", () => tx.user.updateMany({ data: { selectedClientId: null } })],
        ["ClientLogo", () => tx.client.updateMany({ data: { logoFileId: null } })],
        ["File", () => tx.file.deleteMany(all)],
        ["StoredBlob", () => tx.storedBlob.deleteMany(all)],
        ["Client", () => tx.client.deleteMany({ where: { isInternal: false } })],
      ];
      for (const [name, step] of steps) result[name] = (await step()).count;
      await tx.setting.create({ data: { key: LIVE_RESET_KEY, value: now.toISOString() } });
    },
    { timeout: 120_000 },
  );
  return result;
}

/**
 * Startpasswörter aus INITIAL_PASSWORD_HASHES ({"Vorname": "scrypt$…"}): nur für Personen ohne Passwort,
 * damit ein Neustart nie ein selbst geändertes Passwort überschreibt.
 */
export async function applyInitialPasswords(db: PrismaClient, raw: string | undefined): Promise<number> {
  if (!raw) return 0;
  const hashes = JSON.parse(raw) as Record<string, string>;
  let count = 0;
  for (const [name, hash] of Object.entries(hashes)) {
    if (!hash.startsWith("scrypt$")) continue;
    const users = await db.user.findMany({ where: { name: { equals: name, mode: "insensitive" }, passwordHash: null } });
    if (users.length !== 1) continue;
    await db.user.update({ where: { id: users[0]!.id }, data: { passwordHash: hash } });
    count++;
  }
  return count;
}
