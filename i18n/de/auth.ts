export const auth = {
  loginTitle: "Anmelden",
  loginIntro: "Melde dich mit deinem Microsoft-Konto von Rud Pedersen an.",
  loginWithMicrosoft: "Mit Microsoft anmelden",
  devLoginTitle: "Entwickler-Login",
  devLoginIntro: "Nur lokal: Wähle einen Seed-Nutzer. Im Betrieb ist diese Anmeldung abgeschaltet.",
  demoLoginTitle: "Demo-Anmeldung",
  demoLoginIntro: "Wähle eine Beispielperson. Alle Kunden, Texte und Kontakte sind erfunden.",
  demoBanner: "Demo mit erfundenen Beispieldaten. Bitte keine echten Kunden- oder Kontaktdaten eingeben.",
  demoPasswordRealm: "impress Demo",
  devLoginAs: (name: string) => `Als ${name} anmelden`,
  noAccessTitle: "Kein Zugang",
  noAccessText:
    "Für dein Microsoft-Konto ist in impress noch kein Nutzer angelegt oder dein Zugang ist gesperrt. Bitte wende dich an einen CVD.",
  backToLogin: "Zurück zur Anmeldung",
} as const;
