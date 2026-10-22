export const header = {
  clientSelect: "Kundenauswahl",
  search: "Suche",
  searchPlaceholder: "Aufgaben, Dokumente, Kontakte, Kunden …",
  newTask: "Neue Aufgabe",
  notifications: "Benachrichtigungen",
  unread: (count: number) => (count === 1 ? "1 ungelesene Benachrichtigung" : `${count} ungelesene Benachrichtigungen`),
  profile: "Profil",
  profileSettings: "Eigene Einstellungen",
  setupPush: "Push einrichten",
  signOut: "Abmelden",
} as const;
