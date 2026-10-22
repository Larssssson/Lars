# CHANGELOG

## Nach Phase 6 · 2026-10-22

- GitHub Codespaces: `.devcontainer/` mit App und PostgreSQL, impress lässt sich ohne lokale Installation im Browser ausprobieren (README).

## Phase 6: Push, Livegang-Reife, Übergabe · 2026-10-21

- PWA: Web App Manifest, App-Icons, Service Worker für Push (ohne Offline-Cache), Sicherheits-Header; installierbar auf Desktop, Android und iOS ab 16.4.
- Profil mit „Push einrichten“: Anleitung je Gerät, Erlaubnis, Abonnement, mehrere Geräte einzeln entfernbar, Testnachricht; ungültige Geräte werden entfernt. Im Ersatz-Modus ein Ersatz-Gerät.
- Push genau für die Ereignisse aus 7.9, an alle Geräte der Person; Eskalation dringender Freigaben nach 30 Minuten an alle Freigabeberechtigten und nach 60 Minuten an den CVD vom Dienst (sonst alle CVDs), Job `freigaben-eskalieren`.
- Verwaltung: Einstellungen (Eskalationszeiten, Relevanzschwelle, Anzahl Top-Artikel, RP-Vorlage mit Farbe, Schrift und Logo), Integrationen und KI (Status aller Dienste, Modellwahl), Kennzahlen (aktive Nutzer pro Woche, Aufgaben pro Status, mittlere Freigabezeit, Push pro Person und Tag, verifizierte Kontakte im Zeitverlauf, Pressespiegel-Dienste erledigt), Protokoll mit Suche, Bereich, Aktion und Zeitraum; Einstellungen im Protokoll.
- Smartphone-Ansicht für Dashboard, Freigabe und Kontaktanfragen geprüft.
- Echte Adapter: Microsoft Graph (SharePoint), Azure Blob, Web Push (VAPID, aes128gcm), Entra ID mit schlankem Profil und Gesundheitsprüfung; getestet gegen Azurite und Mock-Server (`npm run test:adapters`).
- Betrieb: Dockerfile (App, Worker, Migration in einem Image, Chromium für PDF), `/api/health` (Datenbank, Speicher, KI, SharePoint), OPERATIONS.md mit Variablen, Jobs, Sicherung, Logs und bekannten Grenzen; Build ohne Zugangsdaten.
- `npm run seed:clear-samples` löscht auch die Beispieldateien im Speicher; `npm run user:bootstrap` legt den ersten echten CVD an.
- Migrationen `phase6_escalation` und `phase6_metrics`.

## Phase 5: Pressespiegel · 2026-10-21

- Import des Meltwater-Exports (CSV und XLSX) mit Spaltenzuordnung, die gespeichert und beim nächsten Import vorgeschlagen wird; gleiche Artikel (URL oder Headline, Medium, Tag) werden zusammengefasst; Artikel von Hand anlegen.
- Bekannte Autoren (Name plus Medium) werden beim Import automatisch der Artikel-Historie im Journo Hub zugeordnet; neue Autoren nur per Klick „Autor in Journo Hub übernehmen“ (Label Pressespiegel, wer klickt, wird Owner).
- Relevanz je Kunde mit Wert und Begründung über die KI (Prompt `relevance`), Kunden ohne „KI erlaubt“ bleiben unbewertet. Ansichten „Heute relevant“ (Top 10 ab 50 je Kunde) und „Alle Artikel“ mit Suche und Zeitraum.
- Aufnehmen je Kunde; Volltext einfügen mit Neubewertung und Löschung nach 30 Tagen (Job `volltexte-loeschen`).
- Aktionen: Einschätzung, LinkedIn-Kommentar (nur mit Leistung LinkedIn), Newshook-Pitch an Autor und Medium, Autor übernehmen; Ergebnisse als Aufgaben in der Redaktion mit KI-Entwurf als KI-Baustein und Link am Artikel.
- Pressespiegel-Dokument pro Kunde mit allen heute aufgenommenen Artikeln, KI-Kurzfassung und Platzhalter für die Einschätzung.
- Aufgabe „Pressespiegel [Datum]“ automatisch zu Dienstbeginn (Job `pressespiegel-aufgabe`) beim internen Kunden „RP intern“, sichtbar bei jeder Kundenauswahl; Frist am Diensttyp einstellbar (Standard 9:30).
- Kachel Pressespiegel auf dem Dashboard.
- Beispieldatei 13.3 `fixtures/monitoring/meltwater_sample.csv` und `.xlsx`, KI-Beispielantworten für Relevanz, Kurzfassung und Entwürfe; XLSX-Lesen gemeinsam für Journo Hub und Pressespiegel (`lib/files/tabular.ts`).
- Migrationen `phase5_internal_relevance` und `phase5_review_due`.

## Phase 4: Journo Hub · 2026-10-21

- Kontaktverzeichnis mit Medien (Typ, Ressorts) und Kontakten (Name, Medium, Ressort, Funktion, Themen, Region, Notizen, Kontaktdaten), Status-Labels in Farbe und Wort, Liste mit Filtern nach Medium, Medientyp, Ressort, Thema, Status und Owner; zuletzt geschrieben aus der Artikel-Historie.
- Kontaktdaten getrennt gespeichert und immer verdeckt (Telefon mit den letzten 2 Ziffern); Aufdecken für Owner, CVDs und nach Freigabe für den gewählten Kunden bzw. das Projekt, jedes Aufdecken im Protokoll.
- Verifizieren mit Telefon, Mail und erstem Kontakt, wer verifiziert wird Owner; CVDs entziehen mit Grund.
- Owner mit „seit“, Beziehungsnotiz und -qualität; höchstens 3 aktive, ein vierter wartet auf einen CVD; inaktive Owner nach Offboarding.
- Kontaktanfrage (6.7): Push und Glocke an die Owner, Freigeben, Selbst übernehmen (Aufgabe), Ablehnen mit Begründung, Erinnerung nach 24 Stunden, Übersicht für CVDs; danach selbst als Owner eintragen.
- „Wer kennt jemanden bei diesem Medium“ auf Kontakten ohne Owner.
- Import von CSV, XLSX und vCard in vier Schritten mit speicherbarer Zuordnung, Dubletten (Mail, Telefon nach E.164, Name plus Medium) und Entscheidung je Zeile.
- Wöchentliche Pflege (Montag 6 Uhr): mögliche Dubletten und Kontakte ohne Aktivität seit 24 Monaten für die CVDs.
- Reiter Journalisten im Editor: passende Kontakte mit Begründung, verifizierte zuerst, Sperrfrist oben; Öffnen, Anfragen, Vormerken; vorgemerkte Kontakte als Empfängervorschlag beim Versand an Medien.
- Offboarding in der Verwaltung: Aufgaben übertragen, Kontakte übertragen, Notiz oder inaktiv, Abschluss sperrt den Zugang.
- Auskunft als JSON und PDF und endgültiges Löschen von Kontakten (nur CVD), Protokoll ohne personenbezogene Inhalte.
- Suche findet Kontakte über Name und Medium. Importdateien sind nur für die hochladende Person abrufbar.
- Seed 13.2 mit Medien, Journalisten, Kontaktdaten, Ownern und Artikel-Historie; Beispieldateien `fixtures/contacts/` (CSV, vCard, XLSX).

## Phase 3: Kundenprofil, Prüfung, KI-Bausteine · 2026-10-21

- Kundenprofil mit allen 16 Abschnitten aus 7.7: „bestätigt am“ mit Person, Warnung nach 90 Tagen, Compliance nach 365 Tagen rot. Kunden-Lead und CVD bearbeiten (Kommunikationsziele, KPIs, Leistungen, Stammdaten nur CVD), Redakteure schlagen vor.
- Vereinbarte Leistungen und KPIs pflegen, Sprecher mit Zitatfreigabe, Strenge der Prüfung in den Stammdaten.
- Onboarding-Assistent: Unterlagen hochladen (PDF, Word, Text; Ablage im SharePoint unter 01_Kundenprofil), KI-Vorschläge je Abschnitt, Fragen zu Lücken, Antworten landen im Abschnitt; unterbrechbar. Onboarding → Aktiv nur mit allen Pflichtabschnitten.
- Lernendes Profil: Vorschläge aus Unterlagen und erledigten Texten, Annahme oder Ablehnung durch Kunden-Lead oder CVD.
- Prüfung im Editor: Schnellprüfung und Vollanalyse, Strukturprüfung regelbasiert, übrige Schritte mit KI; Konformität und Medienresonanz, Profilwarnungen, Hinweise nach Prüfschritt mit Fundstelle (Klick springt hin), Erledigt, Verwerfen, Verwerfungsregeln pro Kunde (im Profil einsehbar und löschbar). Offene Hinweise im Freigabebereich.
- Live-Hinweise beim Schreiben ohne KI unter dem Editor.
- KI-Bausteine: Headline (eine von drei wählen), Zitat mit Sprecher, Lead straffen; hellblau mit Label KI bis zur Übernahme, Freigabeanfrage gesperrt, Übernahme im Verlauf. Angebot aus Prüfhinweisen.
- Reiter Kundenwissen: Kernbotschaften, Sprecher, Factsheet, Boilerplate, Q&A, letzte fünf finale Texte; Fakten und Boilerplate einfügen.
- ai-service mit elf versionierten Prompts, Zod-Prüfung, einem zweiten Versuch, Entfernen von Mailadressen und Telefonnummern, Sperre bei „KI erlaubt“ aus; Beispielantworten in `fixtures/ai/`. Echter Claude-Adapter (Anthropic SDK).
- Seed 13.1: Beispielprofile für Covenant, Ground A und Rafael, zwei SAFENET-Unterlagen als PDF.
- Migrationen `phase3_profile_checks` und `phase3_check_version`; deutsche Seite „Nicht gefunden“.

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
