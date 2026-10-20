# DECISIONS.md

Entscheidungen zu Punkten, die das Briefing nicht oder widersprüchlich regelt (Arbeitsregel 2). Format: Datum, Frage, Entscheidung, Begründung in einem Satz. Einträge mit **[offen]** warten auf eine Bestätigung durch Lars; bis dahin gilt die genannte Entscheidung.

## Dokument und Daten

**D-001** · 2026-10-20
Frage: Die Abschnitte 7.5 bis 7.10 stehen im Original hinter Abschnitt 17.
Entscheidung: In BRIEFING.md vor Abschnitt 8 einsortiert, Inhalt unverändert.
Begründung: Reine Formatierungsfrage, die Nummerierung zeigt die gemeinte Reihenfolge.

**D-002** · 2026-10-20
Frage: 3.4 nennt keine Kunden-Leads für Lars und Lukas, 13.1 schon (Lukas: Covenant, Lars: Ground A und Rafael).
Entscheidung: 13.1 ist maßgeblich; der Seed setzt diese Leads zusätzlich zu Valentin Abel (SAFENET).
Begründung: 13.1 ist vollständiger und widerspricht 3.4 nicht, sondern ergänzt es.

**D-003** · 2026-10-20
Frage: In 13.2 hat Tim Neumann laut Tabelle den Owner Mika, laut Text ist er „absichtlich ohne Owner“.
Entscheidung: Tim Neumann wird ohne Owner angelegt.
Begründung: Der Text nennt den Zweck (Test von „Wer kennt jemanden bei diesem Medium“), der nur ohne Owner funktioniert.

**D-004** · 2026-10-20
Frage: Abschnitt 13 verlangt `isSampleData`, das Datenmodell in Abschnitt 5 enthält das Feld nicht.
Entscheidung: Jede Tabelle außer `User` bekommt `isSampleData Boolean @default(false)`; Konfiguration (Diensttypen, Darstellungsformen, Einstellungen) gilt nicht als Beispieldaten.
Begründung: So entfernt `npm run seed:clear-samples` genau die erfundenen Inhalte und lässt Nutzer und Grundkonfiguration stehen.

**D-005** · 2026-10-20
Frage: Das Datenmodell braucht für einige beschriebene Funktionen zusätzliche Tabellen.
Entscheidung: Ergänzt werden `Setting` (Einstellungen der Verwaltung), `DocumentFormat` (Darstellungsformen, in der Verwaltung erweiterbar), `ImportMapping` (gespeicherte Spaltenzuordnungen, auf die `MonitoringImport.mappingId` verweist), `ContactBookmark` (Kontakt für einen Text vormerken) und `Session` für Auth.js.
Begründung: Alle fünf sind im Briefing als Funktion beschrieben, nur nicht als Tabelle; Bedeutung und Beziehungen des Kernmodells bleiben unverändert.

**D-006** · 2026-10-20
Frage: `Dispatch.target` kennt KUNDE, MEDIEN, INTERN, der Ablauf in 6.5 unterscheidet aber „Kunde zur Abstimmung“ und „Kunde final“.
Entscheidung: Ziele `KUNDE_ABSTIMMUNG`, `KUNDE_FINAL`, `MEDIEN`, `INTERN`; alle außer `KUNDE_ABSTIMMUNG` führen zu Erledigt mit Ablage im SharePoint.
Begründung: Feldnamen dürfen technisch angepasst werden, und nur so lässt sich der Statusübergang eindeutig ableiten.

**D-007** · 2026-10-20
Frage: Statuswerte für Projekte sind nicht festgelegt.
Entscheidung: `GEPLANT`, `LAUFEND`, `ABGESCHLOSSEN`, `ABGEBROCHEN`; die Leistung zählt nur bei `ABGESCHLOSSEN` hoch.
Begründung: Einfachste Menge, die den Ablauf in 6.6 abbildet.

**D-008** · 2026-10-20
Frage: Kategorien vereinbarter Leistungen sind nicht festgelegt, 7.6 braucht aber die Kategorie „LinkedIn“.
Entscheidung: Feste Liste `PRESSEMITTEILUNG`, `MEDIEN_PITCH`, `HINTERGRUNDGESPRAECH`, `ROUNDTABLE`, `PRESSE_EVENT`, `LINKEDIN`, `SONSTIGES`. `doneCount` = erledigte Aufgaben mit dieser Leistung im Zeitraum plus abgeschlossene Projekte mit dieser Leistung.
Begründung: Deckt alle Beispielleistungen aus 13.1 ab und macht die LinkedIn-Regel prüfbar.

## Rechte

**D-009** · 2026-10-20
Frage: Freigaberecht für einen Kunden existiert doppelt: `ClientMember.canApprove` (Kunden-Lead) und `PermissionGrant APPROVE` mit `clientId`.
Entscheidung: Kunden-Leads erhalten das Recht über `canApprove`, alle anderen Redakteure über `PermissionGrant`; die Rechteprüfung wertet beides aus, beides wird protokolliert.
Begründung: Entspricht 3.2 (Lead-Schalter durch CVD) und 3.3 (Zusatzrecht pro Person) ohne neue Konzepte.

**D-010** · 2026-10-20 **[offen]**
Frage: Rechtematrix und 6.8 sagen „Ziele pflegt nur der CVD“, 7.7 sagt „Ziele und Kernbotschaften pflegt der Kunden-Lead“.
Entscheidung: Im Abschnitt „Ziele und Kernbotschaften“ pflegt der CVD die Kommunikationsziele, Kunden-Lead und CVD pflegen die Kernbotschaften.
Begründung: Erfüllt beide Textstellen, ohne einer zu widersprechen.

**D-011** · 2026-10-20
Frage: Jeder darf Kontakte bearbeiten, aber nicht jeder darf Telefon und Mail sehen.
Entscheidung: Wer keinen Zugriff hat, kann Kontaktdaten ergänzen oder ersetzen, sieht sie aber weiterhin nur verdeckt.
Begründung: So bleiben „Kontakt bearbeiten: ja“ und „Kontaktdaten sehen: nur Owner oder nach Freigabe“ beide gültig.

**D-012** · 2026-10-20
Frage: Wann gilt eine Kontaktfreigabe „für den aktuell gewählten Kunden“, besonders bei Auswahl „Alle Kunden“ oder bei Projektbindung?
Entscheidung: Eine Kundenfreigabe gilt, wenn in der Kopfzeile genau dieser Kunde gewählt ist; eine Projektfreigabe gilt im Kontext einer Aufgabe dieses Projekts. Bei „Alle Kunden“ zeigt impress den Hinweis, einen Kunden zu wählen.
Begründung: Hält die Freigabe an den Kontext gebunden, wie 15.1 es verlangt.

## Aufgaben, Priorität, Status

**D-013** · 2026-10-20
Frage: Grenzen der Prioritätsstufen sind nicht genau definiert.
Entscheidung: Dringend = Frist ≤ 2 Stunden, überschritten oder CVD-Markierung; Hoch = Frist am heutigen Kalendertag (Europe/Berlin); Normal = Frist bis Ende des dritten Werktags nach heute; Niedrig = später. Die Priorität wird beim Lesen berechnet, der 5-Minuten-Job speichert sie und löst „Meine Aufgabe wird Dringend“ aus.
Begründung: Listen sind so nie veraltet, und die Benachrichtigung entsteht genau einmal beim Übergang.

**D-014** · 2026-10-20
Frage: Berliner Feiertage für die Werktagsberechnung.
Entscheidung: Eigene Berechnung ohne Bibliothek: Neujahr, Internationaler Frauentag (8.3.), Karfreitag, Ostermontag, 1. Mai, Christi Himmelfahrt, Pfingstmontag, 3. Oktober, 25. und 26. Dezember.
Begründung: Feste Liste mit Osterformel, vollständig testbar und ohne zusätzliche Abhängigkeit.

**D-015** · 2026-10-20
Frage: Uhrzeit bei der Schnellwahl „in 3 Werktagen“.
Entscheidung: Gleiche Uhrzeit wie jetzt, drei Werktage später.
Begründung: Wörtlichste Lesart der Schnellwahl.

**D-016** · 2026-10-20
Frage: Das Dashboard gruppiert in drei Gruppen, die Priorität hat vier Stufen.
Entscheidung: Dringend = Dringend, Heute = Hoch, Demnächst = Normal und Niedrig.
Begründung: „Heute“ entspricht der Regel für Hoch, alles Spätere ist „Demnächst“.

**D-017** · 2026-10-20
Frage: Was heißt „der Owner bekommt die Aufgabe Versenden“ (6.4.6)?
Entscheidung: Kein neuer Task; die bestehende Aufgabe zeigt den nächsten Schritt „Versenden“, der Owner wird benachrichtigt.
Begründung: Ein zweiter Task würde Frist, Kunde und Status doppelt führen.

**D-018** · 2026-10-20
Frage: Wer darf während „Freigabe angefragt“ schreiben?
Entscheidung: Nur der Freigeber, der die Prüfung übernommen hat (mit Änderungsverfolgung). Der Owner kann die Anfrage zurückziehen (`ZURUECKGEZOGEN`), dann ist der Text wieder In Bearbeitung.
Begründung: Verhindert, dass sich der Text unter dem prüfenden Freigeber ändert.

**D-019** · 2026-10-20
Frage: Was ist die „saubere Fassung“, wenn ein Freigeber mit Änderungsverfolgung ändert und freigibt?
Entscheidung: Freigegeben und exportiert wird die Fassung mit allen Änderungen übernommen, ohne Markierungen und Kommentare. Die Markierungen bleiben im Verlauf sichtbar; wer eine davon ablehnen will, ändert den Text und setzt ihn damit auf In Bearbeitung zurück.
Begründung: Der Freigeber gibt frei, was er sieht, und die Regel „Änderung nach Freigabe braucht neue Freigabe“ bleibt intakt.

**D-020** · 2026-10-20
Frage: Werden auch einfache Aufgaben 30 Tage nach Erledigt archiviert?
Entscheidung: Ja.
Begründung: Gleiche Regel für alle Listen ist einfacher und erwartbar.

## Navigation, Oberfläche

**D-021** · 2026-10-20
Frage: Abschnitt 4 spricht von sechs Bereichen, die Tabelle nennt sieben.
Entscheidung: Sieben Einträge in der Navigation; Verwaltung ist nur für CVDs und Admins sichtbar.
Begründung: Für Redakteure sind es sechs Bereiche, wie im Text beschrieben.

**D-022** · 2026-10-20
Frage: Die Suche in der Kopfzeile steht in keiner Phase der Abnahmekriterien.
Entscheidung: Phase 1 sucht in Aufgaben und Kunden, Phase 2 ergänzt Dokumente, Phase 4 Kontakte.
Begründung: Jede Phase sucht in dem, was sie schon gebaut hat.

**D-023** · 2026-10-20
Frage: Die Verwaltung der Darstellungsformen steht in keiner Phase.
Entscheidung: Wird in Phase 2 mit dem Editor gebaut.
Begründung: Vorlagen und Strukturprüfung hängen direkt davon ab.

**D-024** · 2026-10-20
Frage: Das Dashboard aus Phase 1 zeigt Warnungen und wartende Freigaben, deren Funktionen erst in Phase 2 und 3 entstehen.
Entscheidung: Phase 1 zeigt diese Blöcke auf Basis der Seed-Daten (Bestätigungsdaten der Profilabschnitte, Approval-Einträge, berechneter Leistungsstand); Bearbeitung folgt in den jeweiligen Phasen. Ebenso deckt Phase 1 alle Zeilen der Rechtematrix als Rechtefunktionen mit Tests ab, auch für Bereiche, deren Oberfläche später kommt.
Begründung: So sind die Abnahmekriterien von Phase 1 vollständig erfüllbar, ohne spätere Phasen vorzuziehen.

**D-025** · 2026-10-20
Frage: Zeiten für den Wochenenddienst fehlen.
Entscheidung: Samstag und Sonntag, 9 bis 17 Uhr, in der Verwaltung änderbar.
Begründung: Übliche Kernzeit, jederzeit anpassbar.

## Technik

**D-026** · 2026-10-20
Frage: Welche Versionen sind „aktuell stabil“?
Entscheidung: Node 22, Next.js 16, React 19, Tailwind CSS 4, Prisma 7 (Prisma 8 ist nur als Release Candidate verfügbar, obwohl unter „latest“ veröffentlicht), Zod 4, Vitest, Playwright 1.64, TipTap 3, pg-boss 12.
Begründung: Neueste Versionen ohne Vorabstatus, Stand 20.10.2026.

**D-027** · 2026-10-20 **[offen]**
Frage: Auth.js v5 ist weiterhin nur als Beta verfügbar (5.0.0-beta.32), die stabile Linie ist v4.
Entscheidung: Auth.js v5 (Beta) hinter der Schnittstelle `AuthProvider`, damit ein späterer Wechsel nur den Adapter betrifft.
Begründung: Das Briefing verlangt Auth.js, v5 ist die für den App Router vorgesehene Version.

**D-028** · 2026-10-20
Frage: Der Entwickler-Login ist laut 10.1 nur bei `NODE_ENV=development` erlaubt, Vitest und Playwright laufen aber mit `NODE_ENV=test`.
Entscheidung: Entwickler-Login, wenn `AUTH_PROVIDER=dev` und `NODE_ENV` nicht `production` ist; bei `production` verweigert die App den Start mit `AUTH_PROVIDER=dev`.
Begründung: Tests brauchen den Login, und für den Betrieb bleibt er hart ausgeschlossen.

**D-029** · 2026-10-20
Frage: Gesperrte Nutzer sollen sofort den Zugang verlieren, auch in laufenden Sitzungen.
Entscheidung: Sitzungen in der Datenbank (12 Stunden), bei jeder Anfrage wird `User.active` geprüft.
Begründung: Reine Token-Sitzungen lassen sich nicht sofort widerrufen.

**D-030** · 2026-10-20
Frage: Wo laufen die pg-boss-Jobs?
Entscheidung: In einem eigenen Worker-Prozess (`npm run worker`, eigener Dienst in Docker Compose), nicht im Next.js-Server.
Begründung: Next.js-Server können je nach Hosting schlafen oder mehrfach laufen; ein Worker macht Zeitpläne verlässlich.

**D-031** · 2026-10-20
Frage: Welche Seeds und Fixtures entstehen wann?
Entscheidung: Jede Phase seedet die Daten, die sie nutzt (Phase 0 Nutzer, Kunden, Zuordnungen, Diensttypen; Phase 1 Aufgaben, Leistungen, Dienstplan, Bestätigungsdaten der Profilabschnitte; Phase 2 Dokumente, Versionen, Freigaben; Phase 3 Profilinhalte und KI-Fixtures; Phase 4 Medien, Journalisten, Kontaktdateien; Phase 5 Meltwater-Dateien). Am Ende ist der Seed vollständig wie in Abschnitt 13.
Begründung: Fixtures werden in der Phase erzeugt, deren Tests sie prüfen.

**D-032** · 2026-10-20
Frage: Sonderzeichen in SharePoint-Dateinamen (Abschnitt 9).
Entscheidung: Umlaute werden umgeschrieben (ä → ae, ö → oe, ü → ue, ß → ss), andere Zeichen außer Buchstaben, Ziffern, Bindestrich und Unterstrich entfallen.
Begründung: Lesbare Namen, die das Beispiel aus Abschnitt 9 genau treffen.

**D-033** · 2026-10-20
Frage: Einstellungen, die sowohl als Umgebungsvariable als auch in der Verwaltung änderbar sind (Modelle, SharePoint-Wurzelpfad).
Entscheidung: Die Umgebungsvariable ist der Standard, ein Wert in der Verwaltung überschreibt ihn.
Begründung: Betrieb startet ohne Pflege in der Oberfläche, Admins können trotzdem umstellen.

**D-034** · 2026-10-20
Frage: Wird die Kennzahl „höchstens drei Push pro Person und Tag“ technisch erzwungen?
Entscheidung: Nein, sie wird nur gemessen; Push entsteht ausschließlich für die Ereignisse aus 7.9.
Begründung: Eine Drosselung könnte eine wirklich dringende Nachricht unterdrücken.

**D-035** · 2026-10-20
Frage: Ziel-Ordner für die Darstellungsform „Einladung“ ohne Bezug zu Medien.
Entscheidung: Immer 04_Medienansprache, mit Projekt 07_Projekte.
Begründung: Abschnitt 9 nennt nur diese Zuordnung.

**D-036** · 2026-10-20
Frage: Wird beim Übernehmen eines Autors aus dem Pressespiegel jemand Owner?
Entscheidung: Nein, der Kontakt bleibt ohne Owner, bis sich jemand einträgt oder verifiziert.
Begründung: Owner heißt „kennt den Journalisten persönlich“, ein Klick im Pressespiegel belegt das nicht.

**D-037** · 2026-10-20 **[offen]**
Frage: Das Briefing nennt Lars Scholtyssyk und Valentin Abel mit vollem Namen im Seed; die Arbeitsregel verbietet echte Personendaten im Code.
Entscheidung: Der Seed enthält die Namen wie in 3.4, aber nur Platzhalter-Mailadressen (`lars@example.com`, `valentin@example.com`). Die echten Adressen werden vor dem Livegang in der Verwaltung eingetragen.
Begründung: Die Namen sind für die Zuordnung im Team nötig, Mailadressen sind es lokal nicht.
