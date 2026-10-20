export const notifications = {
  title: "Benachrichtigungen",
  empty: "Keine Benachrichtigungen.",
  markAllRead: "Alle als gelesen markieren",
  markRead: "Als gelesen markieren",
  unread: "ungelesen",
  push: "Push",
  pushTitle: "impress",
  pushBody: (client: string, task: string, due: string) => `${client} · ${task} · Frist ${due}`,
  taskAssigned: (title: string) => `Dir wurde eine Aufgabe zugewiesen: ${title}`,
  taskUrgent: (title: string) => `Deine Aufgabe ist dringend: ${title}`,
} as const;
