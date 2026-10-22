import { z } from "zod";
import { t } from "@/i18n";
import { AuditAction, writeAudit } from "@/lib/domain/audit";
import type { Deps } from "@/lib/domain/deps";
import { DomainError } from "@/lib/domain/errors";
import { assert, canManageTechnicalSettings, canOpenAdministration, type Actor } from "@/lib/domain/permissions";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Einstellungen der Verwaltung (BRIEFING 7.10). Werte liegen als JSON in `Setting`; fehlt ein Wert,
 * gilt der Standard aus dem Briefing. Die Frist der Pressespiegel-Aufgabe steht am Diensttyp (D-108).
 */
export const GENERAL_DEFAULTS = {
  /** Eskalation dringender Freigaben (BRIEFING 6.4): Freigabeberechtigte, dann CVD vom Dienst */
  escalationFirstMinutes: 30,
  escalationSecondMinutes: 60,
  /** "Heute relevant" (BRIEFING 7.6) */
  relevanceThreshold: 50,
  topArticles: 10,
};

export type GeneralSettings = typeof GENERAL_DEFAULTS;

const minutes = z.coerce.number().int().min(5, t.admin.settings.errors.minutes).max(24 * 60, t.admin.settings.errors.minutes);

export const generalSchema = z
  .object({
    escalationFirstMinutes: minutes,
    escalationSecondMinutes: minutes,
    relevanceThreshold: z.coerce.number().int().min(0, t.admin.settings.errors.threshold).max(100, t.admin.settings.errors.threshold),
    topArticles: z.coerce.number().int().min(1, t.admin.settings.errors.top).max(50, t.admin.settings.errors.top),
  })
  .refine((v) => v.escalationSecondMinutes > v.escalationFirstMinutes, { message: t.admin.settings.errors.order });

async function read<T extends object>(db: Pick<PrismaClient, "setting">, key: string): Promise<Partial<T>> {
  const setting = await db.setting.findUnique({ where: { key } });
  return (setting?.value ?? {}) as Partial<T>;
}

async function write(deps: Pick<Deps, "db">, actor: Actor, key: string, value: Prisma.InputJsonValue) {
  const before = await deps.db.setting.findUnique({ where: { key } });
  await deps.db.setting.upsert({
    where: { key },
    update: { value, updatedBy: actor.id },
    create: { key, value, createdBy: actor.id, updatedBy: actor.id },
  });
  await writeAudit(deps.db, { actorId: actor.id, action: AuditAction.SETTINGS_CHANGED, entity: "Setting", entityId: key, before: (before?.value ?? undefined) as Prisma.InputJsonValue | undefined, after: value });
}

export async function generalSettings(db: Pick<PrismaClient, "setting">): Promise<GeneralSettings> {
  return { ...GENERAL_DEFAULTS, ...(await read<GeneralSettings>(db, "general")) };
}

export async function updateGeneralSettings(deps: Pick<Deps, "db">, actor: Actor, raw: Record<string, unknown>) {
  assert(canOpenAdministration(actor));
  const parsed = generalSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? t.errors.invalidInput);
  await write(deps, actor, "general", parsed.data);
}

/** RP-Vorlage für Word und PDF (BRIEFING 7.3); das Logo ist eine hochgeladene Datei. */
export type RpTemplateSettings = { color?: string; font?: string; logoFileId?: string };

export function rpTemplateSettings(db: Pick<PrismaClient, "setting">) {
  return read<RpTemplateSettings>(db, "rpTemplate");
}

export async function updateRpTemplate(
  deps: Deps,
  actor: Actor,
  input: { color: string; font: string; logo?: { name: string; mimeType: string; data: Uint8Array } | null },
) {
  assert(canOpenAdministration(actor));
  const color = input.color.trim().replace(/^#/, "").toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(color)) throw new DomainError(t.admin.settings.errors.color);
  const font = input.font.trim();
  if (!font || font.length > 80) throw new DomainError(t.admin.settings.errors.font);
  const current = await rpTemplateSettings(deps.db);
  let logoFileId = current.logoFileId;
  if (input.logo && input.logo.data.byteLength > 0) {
    // PNG oder JPEG wie beim Kundenlogo (DECISIONS D-056)
    if (!["image/png", "image/jpeg"].includes(input.logo.mimeType)) throw new DomainError(t.clients.errors.logoType);
    if (input.logo.data.byteLength > 2 * 1024 * 1024) throw new DomainError(t.clients.errors.logoSize);
    const storageKey = `settings/rp-logo-${crypto.randomUUID()}`;
    await deps.files.put(storageKey, input.logo.data, input.logo.mimeType);
    const stored = await deps.db.file.create({
      data: { storageKey, name: input.logo.name, mimeType: input.logo.mimeType, size: input.logo.data.byteLength, uploadedBy: actor.id, createdBy: actor.id },
    });
    logoFileId = stored.id;
  }
  await write(deps, actor, "rpTemplate", { color, font, ...(logoFileId ? { logoFileId } : {}) });
}

/** Modellwahl (nur Admin); überschreibt AI_MODEL_QUALITY und AI_MODEL_FAST (DECISIONS D-033). */
export type AiModelSettings = { quality?: string; fast?: string };

export function aiModelSettings(db: Pick<PrismaClient, "setting">) {
  return read<AiModelSettings>(db, "aiModels");
}

const modelName = z.string().trim().regex(/^claude-[a-z0-9.-]+$/, t.admin.settings.errors.model);

export async function updateAiModels(deps: Pick<Deps, "db">, actor: Actor, input: { quality: string; fast: string }) {
  assert(canManageTechnicalSettings(actor));
  const value: AiModelSettings = {};
  for (const key of ["quality", "fast"] as const) {
    const raw = input[key].trim();
    if (!raw) continue;
    const parsed = modelName.safeParse(raw);
    if (!parsed.success) throw new DomainError(t.admin.settings.errors.model);
    value[key] = parsed.data;
  }
  await write(deps, actor, "aiModels", value);
}
