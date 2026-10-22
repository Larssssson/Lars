export const warnings = {
  profileStale: (count: number, days: number) =>
    count === 1
      ? `1 Profilabschnitt seit mehr als ${days} Tagen nicht bestätigt`
      : `${count} Profilabschnitte seit mehr als ${days} Tagen nicht bestätigt`,
  complianceStale: (months: number) => `Compliance-Regeln sind ${months} Monate alt`,
  openSuggestions: (count: number) => (count === 1 ? "1 offener Profilvorschlag" : `${count} offene Profilvorschläge`),
  serviceBehind: (title: string, done: number, target: number, period: string, weeks: number) =>
    `${title}: ${done} von ${target} im ${period}, noch ${weeks === 1 ? "1 Woche" : `${weeks} Wochen`}`,
} as const;
