import { readFile } from "node:fs/promises";
import path from "node:path";
import { t } from "@/i18n";
import type { Deps } from "@/lib/domain/deps";
import { DomainError } from "@/lib/domain/errors";
import type { Client, TemplateChoice } from "@/lib/generated/prisma/client";
import type { ExportTemplate } from "./render-model";

/** Platzhalter bis RP Farbwert, Schrift und Logo liefert (BRIEFING 7.3, 16). */
export const RP_LIGHT_BLUE = "5BB5E5";
export const RP_FONT = "Arial";
const RP_LOGO_PATH = path.resolve("fixtures/templates/rp_logo_placeholder.png");
const LOGO_HEIGHT = 40;

/** Bildgröße aus PNG- oder JPEG-Kopf lesen. */
export function imageSize(data: Uint8Array): { type: "png" | "jpg"; width: number; height: number } | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length > 24 && data[0] === 0x89 && data[1] === 0x50) return { type: "png", width: view.getUint32(16), height: view.getUint32(20) };
  if (data[0] === 0xff && data[1] === 0xd8) {
    let i = 2;
    while (i + 9 < data.length) {
      if (data[i] !== 0xff) return null;
      const marker = data[i + 1]!;
      const len = view.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return { type: "jpg", height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

function scaled(data: Uint8Array): ExportTemplate["logo"] {
  const size = imageSize(data);
  if (!size || size.height === 0) return null;
  return { data, type: size.type, height: LOGO_HEIGHT, width: Math.round((size.width / size.height) * LOGO_HEIGHT) };
}

/** Einstellung "rpTemplate" in der Verwaltung überschreibt die Platzhalter (DECISIONS D-033). */
async function rpSettings(deps: Deps): Promise<{ color: string; font: string; logoFileId?: string }> {
  const setting = await deps.db.setting.findUnique({ where: { key: "rpTemplate" } });
  const value = (setting?.value ?? {}) as { color?: string; font?: string; logoFileId?: string };
  return { color: (value.color ?? RP_LIGHT_BLUE).replace(/^#/, ""), font: value.font ?? RP_FONT, logoFileId: value.logoFileId };
}

async function fileData(deps: Deps, fileId: string): Promise<Uint8Array | null> {
  const file = await deps.db.file.findUnique({ where: { id: fileId } });
  return file ? deps.files.get(file.storageKey) : null;
}

/** RP-Vorlage oder Kundenvorlage; ohne Kundenlogo ist die Kundenvorlage nicht wählbar (BRIEFING 7.3). */
export async function exportTemplate(deps: Deps, choice: TemplateChoice, client: Pick<Client, "logoFileId">): Promise<ExportTemplate> {
  const rp = await rpSettings(deps);
  if (choice === "KUNDE") {
    const data = client.logoFileId ? await fileData(deps, client.logoFileId) : null;
    const logo = data ? scaled(data) : null;
    if (!logo) throw new DomainError(t.documents.errors.clientTemplateUnavailable);
    return { logo, color: rp.color, font: rp.font };
  }
  const data = rp.logoFileId ? await fileData(deps, rp.logoFileId) : new Uint8Array(await readFile(RP_LOGO_PATH));
  return { logo: data ? scaled(data) : null, color: rp.color, font: rp.font };
}
