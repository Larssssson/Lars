# CHANGELOG

## Phase 0: Grundgerüst · 2026-10-20

- Projekt mit Next.js 16 (App Router), React 19, TypeScript strikt, Tailwind CSS 4 und shadcn/ui, Struktur nach BRIEFING 10.5.
- Prisma-Schema für das gesamte Datenmodell aus Abschnitt 5 plus die Ergänzungen aus DECISIONS D-004/D-005, erste Migration. Das Protokoll (AuditLog) ist per Datenbank-Trigger unveränderlich.
- Seed: acht Startnutzer, vier Kunden mit Leads und Teams, drei Diensttypen, 13 Darstellungsformen mit Bausteinen und SharePoint-Ordnern. `npm run seed:clear-samples` entfernt die Beispieldaten.
- Entwickler-Login mit Auswahl der Seed-Nutzer (Auth.js), Seite „Kein Zugang“, Sitzungen 12 Stunden, gesperrte Nutzer verlieren sofort den Zugang.
- Grundlayout: linke Navigation mit sieben Bereichen (Verwaltung nur CVD/Admin), Kopfzeile mit Kundenauswahl, Suche, „Neue Aufgabe“, Glocke und Profilmenü. Die Kundenauswahl gilt für alle Bereiche und wird pro Nutzer gespeichert.
- Adapter für Login, SharePoint, Dateien, KI, Push und Monitoring, jeweils mit Ersatz, umschaltbar per Umgebungsvariable. Die echten Adapter prüfen ihre Zugangsdaten, die Umsetzung folgt in Phase 6.
- Worker-Prozess für pg-boss mit leerem Jobverzeichnis.
- Docker Compose (Datenbank, App, Worker), `.env.example`, SessionStart-Hook für Cloud-Sitzungen.
- Tests mit einem Befehl (`npm test`): Einheit, Integration, Ende zu Ende.
