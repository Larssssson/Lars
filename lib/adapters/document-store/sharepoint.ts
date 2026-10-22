import { requireVars } from "../errors";
import { GraphClient, GraphError, type GraphConfig } from "../microsoft/graph";
import type { DocumentStore } from "./types";

type DriveItem = { name: string; webUrl?: string };

/** Pfadsegmente einzeln kodieren, Schrägstriche bleiben Trenner. */
function encodePath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Echte Ablage in der SharePoint-Bibliothek über Microsoft Graph (BRIEFING 9, 10.2).
 * Alle Pfade liegen unter SHAREPOINT_ROOT_PATH (Standard impress/Kunden).
 */
export class SharePointDocumentStore implements DocumentStore {
  readonly kind = "sharepoint" as const;
  private readonly graph: GraphClient;
  private readonly siteId: string;
  private readonly driveId: string;
  private readonly rootPath: string;

  constructor(
    config: { siteId?: string; driveId?: string; rootPath: string; tenantId?: string; clientId?: string; clientSecret?: string } & Pick<GraphConfig, "graphBaseUrl" | "loginBaseUrl" | "fetch">,
  ) {
    const vars = requireVars("SharePoint", {
      SHAREPOINT_SITE_ID: config.siteId,
      SHAREPOINT_DRIVE_ID: config.driveId,
      ENTRA_TENANT_ID: config.tenantId,
      ENTRA_CLIENT_ID: config.clientId,
      ENTRA_CLIENT_SECRET: config.clientSecret,
    });
    this.siteId = vars.SHAREPOINT_SITE_ID!;
    this.driveId = vars.SHAREPOINT_DRIVE_ID!;
    this.rootPath = config.rootPath.split("/").filter(Boolean).join("/");
    this.graph = new GraphClient({
      tenantId: vars.ENTRA_TENANT_ID!,
      clientId: vars.ENTRA_CLIENT_ID!,
      clientSecret: vars.ENTRA_CLIENT_SECRET!,
      graphBaseUrl: config.graphBaseUrl,
      loginBaseUrl: config.loginBaseUrl,
      fetch: config.fetch,
    });
  }

  private full(relative: string): string {
    const segments = relative.split("/").filter(Boolean);
    if (segments.some((s) => s === ".." || s === ".")) throw new Error("Pfad außerhalb des Ablageordners.");
    return [this.rootPath, ...segments].filter(Boolean).join("/");
  }

  private drive(path = ""): string {
    const encoded = encodePath(path);
    return encoded ? `/drives/${encodeURIComponent(this.driveId)}/root:/${encoded}:` : `/drives/${encodeURIComponent(this.driveId)}/root`;
  }

  /** Ordner Segment für Segment anlegen; vorhandene Ordner bleiben (Konflikt 409 heißt: gibt es schon). */
  async ensureFolder(folder: string): Promise<void> {
    const segments = this.full(folder).split("/");
    for (let i = 0; i < segments.length; i++) {
      const parent = segments.slice(0, i).join("/");
      try {
        await this.graph.json(`${this.drive(parent)}/children`, {
          method: "POST",
          body: { name: segments[i], folder: {}, "@microsoft.graph.conflictBehavior": "fail" },
        });
      } catch (error) {
        if (!(error instanceof GraphError && error.status === 409)) throw error;
      }
    }
  }

  /** Einfacher Upload (bis 250 MB); vorhandene Dateien gleichen Namens werden ersetzt. */
  async putFile(folder: string, fileName: string, data: Uint8Array, mimeType: string): Promise<{ url: string }> {
    if (fileName.includes("/")) throw new Error("Ungültiger Dateiname.");
    await this.ensureFolder(folder);
    const response = await this.graph.request(`${this.drive(`${this.full(folder)}/${fileName}`)}/content`, {
      method: "PUT",
      body: data as BodyInit,
      contentType: mimeType,
    });
    const item = (await response.json()) as DriveItem;
    return { url: item.webUrl ?? "" };
  }

  async listFolder(folder: string): Promise<string[]> {
    const names: string[] = [];
    let next: string | undefined = `${this.drive(this.full(folder))}/children?$select=name`;
    try {
      while (next) {
        const page: { value: DriveItem[]; "@odata.nextLink"?: string } = await this.graph.json(next);
        names.push(...page.value.map((v) => v.name));
        next = page["@odata.nextLink"];
      }
    } catch (error) {
      if (error instanceof GraphError && error.status === 404) return [];
      throw error;
    }
    return names.sort();
  }

  async health() {
    try {
      await this.graph.json(`/sites/${encodeURIComponent(this.siteId)}/drives/${encodeURIComponent(this.driveId)}?$select=id`);
      return { ok: true, detail: "SharePoint erreichbar" };
    } catch (error) {
      return { ok: false, detail: error instanceof GraphError ? error.message : "SharePoint nicht erreichbar" };
    }
  }
}
