/** Echte Implementierung folgt in Phase 6 (BRIEFING 12). Bis dahin nur der Ersatz. */
export class AdapterNotReadyError extends Error {
  constructor(adapter: string) {
    super(`${adapter}: echte Implementierung folgt in Phase 6. Bitte den Ersatz-Adapter verwenden.`);
    this.name = "AdapterNotReadyError";
  }
}

export class AdapterConfigError extends Error {
  constructor(adapter: string, missing: string[]) {
    super(`${adapter}: fehlende Umgebungsvariablen ${missing.join(", ")}.`);
    this.name = "AdapterConfigError";
  }
}

export function requireVars(adapter: string, vars: Record<string, string | undefined>): Record<string, string> {
  const missing = Object.entries(vars)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) throw new AdapterConfigError(adapter, missing);
  return vars as Record<string, string>;
}
