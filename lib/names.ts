/** Vorname für die Anzeige im Dashboard (alle Personen gleich, D-123) */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
