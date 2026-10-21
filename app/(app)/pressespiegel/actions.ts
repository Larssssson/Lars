"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { t } from "@/i18n";
import { DomainError } from "@/lib/domain/errors";
import { createArticleDraft, createPressReview, takeOverAuthor, type DraftKind } from "@/lib/domain/monitoring/actions";
import {
  createManualArticle,
  importMonitoringFile,
  MONITORING_FIELDS,
  parseArticleDate,
  setFullText,
  uploadMonitoringFile,
  type MonitoringMapping,
} from "@/lib/domain/monitoring/articles";
import { rateArticles, rerateArticle, setSelected } from "@/lib/domain/monitoring/relevance";
import { runAction, str, type ActionState } from "@/lib/server/action";
import { serverDeps } from "@/lib/server/deps";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/time";

const id = z.uuid();
const refresh = () => revalidatePath("/", "layout");

export type MonitoringImportState = {
  error?: string;
  fileId?: string;
  fileName?: string;
  columns?: string[];
  sample?: Record<string, string>[];
  mapping?: MonitoringMapping;
  savedApplied?: boolean;
  done?: string;
  notice?: string;
};

/** Ein Zustand für Hochladen und Importieren; "step" wählt den Schritt. */
export async function monitoringImportAction(state: MonitoringImportState, form: FormData): Promise<MonitoringImportState> {
  const step = str(form, "step");
  if (step === "upload") {
    let out: MonitoringImportState = {};
    const result = await runAction(async () => {
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) throw new DomainError(t.monitoring.errors.fileType);
      out = await uploadMonitoringFile(serverDeps(), await requireUser(), { name: file.name, mimeType: file.type, data: new Uint8Array(await file.arrayBuffer()) });
    });
    return result?.error ? { error: result.error } : out;
  }
  if (step === "import") {
    let out: MonitoringImportState = {};
    const result = await runAction(async () => {
      const mapping: MonitoringMapping = {};
      (state.columns ?? []).forEach((column, i) => {
        const value = String(form.get(`map-${i}`) ?? "");
        mapping[column] = (MONITORING_FIELDS as readonly string[]).includes(value) ? (value as MonitoringMapping[string]) : "";
      });
      const deps = serverDeps();
      const imported = await importMonitoringFile(deps, await requireUser(), { fileId: id.parse(state.fileId), mapping });
      const rating = await rateArticles(deps, imported.created);
      const m = t.monitoring.import;
      out = {
        done: m.done(imported.created.length, imported.merged, imported.assigned),
        notice: [rating.rated.length ? m.rated(rating.rated.length) : null, rating.notice, rating.skipped.length ? t.monitoring.aiOff(rating.skipped.join(", ")) : null].filter(Boolean).join(" "),
      };
    });
    refresh();
    return result?.error ? { ...state, error: result.error } : out;
  }
  return {};
}

export async function manualArticleAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const date = str(form, "publishedAt");
    const deps = serverDeps();
    const created = await createManualArticle(deps, await requireUser(), {
      headline: str(form, "headline") ?? "",
      media: str(form, "media") ?? "",
      url: str(form, "url"),
      author: str(form, "author"),
      teaser: str(form, "teaser"),
      publishedAt: date ? parseArticleDate(date) : null,
    });
    await rateArticles(deps, created.created);
    return created.created.length ? t.monitoring.manual.created : t.monitoring.import.done(0, created.merged, 0);
  });
  refresh();
  return result;
}

export async function selectAction(articleId: string, clientId: string, selected: boolean): Promise<ActionState> {
  const result = await runAction(async () => setSelected(serverDeps(), await requireUser(), id.parse(articleId), id.parse(clientId), selected));
  refresh();
  return result;
}

export async function fullTextAction(articleId: string, _state: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const deps = serverDeps();
    const user = await requireUser();
    const saved = await setFullText(deps, user, id.parse(articleId), str(form, "fullText") ?? "");
    await rerateArticle(deps, user, saved.id);
    return saved.fullTextExpiresAt ? t.monitoring.fullTextSaved(formatDate(saved.fullTextExpiresAt)) : t.common.saved;
  });
  refresh();
  return result;
}

export async function articleAction(articleId: string, clientId: string, kind: DraftKind | "KONTAKT_UEBERNEHMEN", _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    const deps = serverDeps();
    const user = await requireUser();
    if (kind === "KONTAKT_UEBERNEHMEN") {
      await takeOverAuthor(deps, user, id.parse(articleId), id.parse(clientId));
      return t.monitoring.actions.contactCreated;
    }
    const draft = await createArticleDraft(deps, user, id.parse(articleId), id.parse(clientId), kind);
    return draft.aiNotice ? `${t.monitoring.actions.createdWithoutAi}${draft.aiNotice}` : t.monitoring.actions.created;
  });
  refresh();
  return result;
}

export async function pressReviewAction(clientId: string, _state: ActionState): Promise<ActionState> {
  const result = await runAction(async () => {
    await createPressReview(serverDeps(), await requireUser(), id.parse(clientId));
    return t.monitoring.review.created;
  });
  refresh();
  return result;
}
