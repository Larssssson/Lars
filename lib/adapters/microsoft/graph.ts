/**
 * Schlanker Zugang zu Microsoft Graph mit App-Token (Client Credentials). Die App-Registrierung
 * ist dieselbe wie für den Login (ENTRA_*), mit Berechtigung für die SharePoint-Site (DECISIONS D-110).
 * Basis-URLs sind nur für Tests gegen einen Mock-Server austauschbar.
 */
export type GraphConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  graphBaseUrl?: string;
  loginBaseUrl?: string;
  fetch?: typeof fetch;
};

export class GraphError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super(`Microsoft Graph: Status ${status}${code ? ` (${code})` : ""}`);
    this.name = "GraphError";
  }
}

export class GraphClient {
  private token: { value: string; expiresAt: number } | null = null;
  private readonly graph: string;
  private readonly login: string;
  private readonly http: typeof fetch;

  constructor(private readonly config: GraphConfig) {
    this.graph = (config.graphBaseUrl ?? "https://graph.microsoft.com/v1.0").replace(/\/$/, "");
    this.login = (config.loginBaseUrl ?? "https://login.microsoftonline.com").replace(/\/$/, "");
    this.http = config.fetch ?? fetch;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const response = await this.http(`${this.login}/${encodeURIComponent(this.config.tenantId)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    });
    if (!response.ok) throw new GraphError(response.status, "token");
    const body = (await response.json()) as { access_token: string; expires_in: number };
    this.token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  }

  /** Anfrage an Graph; path beginnt mit "/" oder ist eine vollständige URL (nextLink). */
  async request(path: string, init: { method?: string; body?: BodyInit; contentType?: string } = {}): Promise<Response> {
    const url = path.startsWith("http") ? path : `${this.graph}${path}`;
    const headers: Record<string, string> = { authorization: `Bearer ${await this.accessToken()}` };
    if (init.contentType) headers["content-type"] = init.contentType;
    const response = await this.http(url, { method: init.method ?? "GET", headers, body: init.body });
    if (!response.ok) {
      const code = await response
        .json()
        .then((b: { error?: { code?: string } }) => b.error?.code ?? null)
        .catch(() => null);
      throw new GraphError(response.status, code);
    }
    return response;
  }

  async json<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const response = await this.request(path, {
      method: init?.method,
      ...(init?.body !== undefined ? { body: JSON.stringify(init.body), contentType: "application/json" } : {}),
    });
    return (await response.json()) as T;
  }
}
