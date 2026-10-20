# CHANGELOG

## Phase 2: Redaktion, Freigabe, Versand · 2026-10-20

- Editor auf TipTap/ProseMirror (nur Open Source) mit allen 13 Darstellungsformen: Bausteine aus der Vorlage mit Beschriftung und Pflichtangabe, Fett, Kursiv, Listen, Links, Zwischenüberschriften, einfache Tabellen, Zeichen- und Normzeilenzähler, automatische Speicherung 5 Sekunden nach der letzten Eingabe. Die Bausteine lassen sich nicht löschen oder verschieben.
- Arbeitsplatz in drei Spalten: Aufgabeninfos, Freigabe und Versand, Versionen, Verlauf; Editor; Seitenleiste mit Kommentaren und Änderungen (Prüfung, Journalisten, Kundenwissen folgen in Phase 3 und 4).
- Bearbeitungssperre: wer schreibt, sperrt; andere lesen mit (alle 5 Sekunden), fordern die Bearbeitung an, der Sperrinhaber gibt ab; Ablauf nach 10 Minuten ohne Eingabe; beim Schließen sichern und freigeben.
- Eigene Änderungsverfolgung als ProseMirror-Plugin: Einfügungen und Löschungen mit Name und Zeit, einzeln oder alle annehmen und ablehnen, automatisch an, wenn jemand anderes als der Owner schreibt.
- Kommentare an markierten Stellen oder zum ganzen Text, mit Antworten, Erwähnungen und erledigt.
- Versionen bei jedem Statuswechsel und manuell, Vergleich zweier Versionen nebeneinander mit markierten Unterschieden.
- Vollständiges Statusmodell für Dokumente, Sperre nach Freigabe, Zurücksetzen bei Änderung.
- Freigabe: anfragen mit vorbelegten Freigebern und Rückfrage ohne Prüfung, gesperrt bei offenen KI-Bausteinen, Übernahme „prüft gerade“, Pflichtkommentar bei Änderungswunsch, kein Freigeben eigener Texte, Selbstfreigabe nur mit Zusatzrecht und markiert; Freigaben im Protokoll.
- Versand und Kundenabstimmung: Word, PDF, Text kopieren, Mail-Entwurf, Empfänger und Kanal, Beim Kunden, Kunde einverstanden, Word-Rückläufer mit neuer Version und neuer Freigabe.
- Word-Import (mammoth) und Export als Word (docx) und PDF (Chromium) mit RP- oder Kundenvorlage, immer saubere Fassung.
- Ablage finaler Texte im SharePoint-Ersatz mit Ordnerstruktur und Dateinamen nach Abschnitt 9; Kundenordner beim Anlegen eines Kunden.
- Projekte als dritte Ansicht der Redaktion: anlegen mit Aufgabenvorschlägen für Roundtable und Presse-Event, Status, Zählung der vereinbarten Leistung.
- Verwaltung der Darstellungsformen; Suche auch im Text der Dokumente; Glocke mit Freigabe angefragt, Entscheidung, Kommentar und Bearbeitungsanfrage.
- Platzhalterlogos (13.7), Seed legt Kundenordner und Logos an.

## Phase 1: Aufgaben, Dashboard, Rechte, Dienstplan · 2026-10-20

- Rechteprüfung für die ganze Matrix aus BRIEFING 3.3 in `/lib/domain/permissions`, mit Zusatzrechten (Freigaberecht pro Kunde, Aufgaben für andere, Selbstfreigabe) und je einem Test pro Zeile und Spalte.
- Verwaltung: Nutzer anlegen, Grundrolle und Admin ändern, Zugang sperren, Zusatzrechte vergeben und entziehen, Kundenzuordnungen; jede Rechteänderung steht im Protokoll.
- Kunden: anlegen mit Kunden-Lead, Stammdaten und Logo, Zuordnungen, Status Onboarding/Aktiv/Archiviert, vereinbarte Leistungen mit Stand und Rückstand.
- Aufgaben anlegen nach 6.1 mit Fristen-Schnellwahl, Anhängen und Vorlage für Dokumente; bearbeiten; Statusmodell der einfachen Aufgaben; CVD-Hochstufung.
- Priorität aus der Frist mit Berliner Werktagen und Feiertagen, beim Lesen berechnet und alle 5 Minuten per Job gespeichert; Archivierung 30 Tage nach Erledigt.
- Dashboard: Meine Aufgaben (Dringend, Heute, Demnächst), Wartet auf meine Freigabe, Dienst heute mit Wochenansicht, Kachel Redaktion, Warnungen, Team-Ansicht für CVDs, leerer Zustand.
- Redaktion als Liste und Tafel mit Filtern nach Projekt, Owner, Status, Darstellungsform, Priorität und Zeitraum; Kunde über die Kopfzeile.
- Dienstplan mit Wochenansicht, Eintragen, Austragen, Woche kopieren; Diensttypen in der Verwaltung.
- Glocke mit „Aufgabe zugewiesen“, „Aufgabe wird Dringend“ (Push), Profilwarnungen und Leistungsrückstand.
- Suche über Aufgaben und Kunden.
- Seed: Beispielaufgaben aus 13.5 mit Dokumenten, Freigaben und Versand, Projekt Roundtable, vereinbarte Leistungen aus 13.1, Bestätigungsdaten der Profilabschnitte, Dienstplan aus 13.6.
- Neue Migration `phase1_attachments_shifts`; `npm run db:migrate -- <name>` erzeugt Migrationen ohne interaktives Prisma.

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
