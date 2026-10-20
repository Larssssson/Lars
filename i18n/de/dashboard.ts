export const dashboard = {
  title: "Dashboard",
  greeting: (name: string) => `Guten Tag, ${name}`,
  filterActive: (client: string) => `Gefiltert auf ${client}`,
  filterAll: "Alle Kunden",
} as const;
