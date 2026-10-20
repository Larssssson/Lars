import { AdapterNotReadyError, requireVars } from "../errors";
import type { DocumentStore } from "./types";

/** Echte Ablage über Microsoft Graph. Implementierung in Phase 6. */
export class SharePointDocumentStore implements DocumentStore {
  readonly kind = "sharepoint" as const;

  constructor(config: { siteId?: string; driveId?: string; rootPath: string }) {
    requireVars("SharePoint", { SHAREPOINT_SITE_ID: config.siteId, SHAREPOINT_DRIVE_ID: config.driveId });
  }

  async ensureFolder(): Promise<void> {
    throw new AdapterNotReadyError("SharePoint");
  }

  async putFile(): Promise<{ url: string }> {
    throw new AdapterNotReadyError("SharePoint");
  }

  async listFolder(): Promise<string[]> {
    throw new AdapterNotReadyError("SharePoint");
  }

  async health() {
    return { ok: false, detail: "noch nicht implementiert" };
  }
}
