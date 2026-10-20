export const common = {
  appName: "impress",
  appClaim: "Presse- und Content-Plattform von Rud Pedersen Berlin",
  allClients: "Alle Kunden",
  comingInPhase: (phase: number) => `Dieser Bereich wird in Phase ${phase} gebaut.`,
  sampleDataHint: "Beispieldaten",
  roles: { REDAKTEUR: "Redakteur", CVD: "CVD" } as const,
  admin: "Admin",
  clientStatus: { ONBOARDING: "Onboarding", AKTIV: "Aktiv", ARCHIVIERT: "Archiviert" } as const,
  memberKind: { LEAD: "Kunden-Lead", TEAM: "Team" } as const,
} as const;
