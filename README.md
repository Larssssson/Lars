# impress

Interne Presse- und Content-Plattform von Rud Pedersen Berlin. Die verbindliche Bauanleitung steht in [BRIEFING.md](BRIEFING.md), Entscheidungen zu offenen Punkten in [DECISIONS.md](DECISIONS.md), Änderungen je Phase in [CHANGELOG.md](CHANGELOG.md), Betrieb und Übergabe in [OPERATIONS.md](OPERATIONS.md).

**Stand:** Phase 6 (Push, Livegang-Reife, Übergabe). Alle Bauphasen aus BRIEFING 12 sind umgesetzt.

## Im Browser ausprobieren, ohne Installation (GitHub Codespaces)

1. Auf GitHub im Repository auf **Code** → Reiter **Codespaces** → **Create codespace on main** klicken (oder direkt: https://codespaces.new/Larssssson/Lars).
2. Warten, bis die Einrichtung durch ist (beim ersten Mal etwa 5 bis 10 Minuten: Pakete, Datenbank, Beispieldaten). impress startet danach von selbst; der Browser öffnet die Adresse, sonst unten im Reiter **Ports** bei „impress (3000)“ auf das Globus-Symbol klicken.
3. Auf der Anmeldeseite einen Seed-Nutzer wählen, etwa „Lars Scholtyssyk“ (CVD, Admin) oder „Laura“ (Redakteurin).

Alles läuft mit Ersatz-Adaptern und Beispieldaten, ohne Zugangsdaten. Die Adresse ist nur für das eigene GitHub-Konto erreichbar. Ein Codespace hält an, wenn niemand ihn nutzt, und lässt sich unter https://github.com/codespaces wieder starten oder löschen. Für GitHub-Konten ist ein Kontingent an Stunden pro Monat frei.

## Start in drei Befehlen

Voraussetzung: Docker mit Docker Compose. Es werden keine Zugangsdaten gebraucht.

```bash
cp .env.example .env
docker compose up --build
open http://localhost:3000        # Linux: xdg-open, Windows: start
```

Docker Compose startet PostgreSQL, die App und den Worker für Hintergrundjobs. Die App wendet beim Start alle Migrationen an und spielt den Seed ein (mehrfaches Einspielen ändert nichts). Auf der Anmeldeseite wählst du einen der Seed-Nutzer (Entwickler-Login).

### Ohne Docker für die App

Mit Node.js 22 und einer PostgreSQL 16 (zum Beispiel nur den Datenbankdienst aus Compose):

```bash
cp .env.example .env
docker compose up -d db          # oder eigene PostgreSQL, DATABASE_URL in .env anpassen
npm install
npm run setup                    # Prisma-Client, Migrationen, Seed
npm run dev                      # http://localhost:3000
npm run worker                   # optional, Hintergrundjobs in einem zweiten Terminal
```

## Tests

```bash
npm test
```

Führt nacheinander aus:

| Befehl | Art | Inhalt |
|---|---|---|
| `npm run test:unit` | Vitest, Einheit | Rechtematrix (jede Zeile), Priorität, Werktage und Feiertage, Statusregeln, Adapter (auch Claude ohne Netz), Änderungsverfolgung, Word-Export und -Import, Dateinamen und Ordner, Versionsvergleich, ai-service, Strukturprüfung, Fundstellen, KI-Bausteine im Editor, Kontaktdaten verdecken, Telefonnummern, Importformate |
| `npm run test:adapters` | Vitest, echte Adapter | Azure Blob gegen Azurite; Microsoft Graph (SharePoint), Entra ID, Claude API und Web Push (verschlüsselt, mit VAPID) gegen lokale Mock-Server |
| `npm run test:integration` | Vitest, Integration | Seed, Aufgaben, Priorität-Job, Archivierung, Redaktion-Filter, Dashboard, Warnungen, Nutzer- und Kundenverwaltung, Protokoll, Dienstplan, Leistung bei 500 Aufgaben, Sperre, Freigabe, Selbstfreigabe, Versand, Rückläufer, PDF, SharePoint-Ablage, Kommentare, Versionen, Projekte, Kundenprofil, Onboarding, Aktivierung, Vorschläge, lernendes Profil, Prüfung in beiden Modi, Verwerfungsregeln, KI-Bausteine, „KI erlaubt“, Journo Hub (Liste, Aufdecken, Verifizieren, Owner, Anfragen, Import, Pflege, Auskunft, Löschen, Journalistenvorschläge, Offboarding, Suche), Pressespiegel (Import CSV/XLSX, Zusammenfassen, Autorenzuordnung, Relevanz, Heute relevant, Volltext-Löschung, Aktionen, LinkedIn nur mit Leistung, Autor übernehmen, Pressespiegel-Dokument, Aufgabe aus dem Dienstplan mit Frist, Kachel), Eskalation dringender Freigaben, Push-Geräte und Testnachricht, Einstellungen, Kennzahlen, Protokollsuche, Beispieldaten entfernen, erster CVD |
| `npm run test:e2e` | Playwright, Ende zu Ende | Login, Kundenauswahl, Aufgaben, Glocke, Hochstufen, Redaktion, Dashboard, Dienstplan, Verwaltung, Kunden, Suche; der ganze Redaktionsablauf aus Phase 2 (PM schreiben, Freigabe mit Änderungsverfolgung, Kunde, Rückläufer, zweite Freigabe, Medien, Datei im SharePoint-Ordner); Sperre, Mitlesen, Kommentare, Versionsvergleich; Projekte; Live-Hinweise, Prüfung, KI-Baustein mit Sperre der Freigabe, Kundenwissen, Kundenprofil, Onboarding SAFENET, KI aus; Journo Hub mit Anfrage und Freigabe, Verifizieren, Import, Reiter Journalisten, Pflege, Auskunft, Löschen, Offboarding; Pressespiegel mit der Beispieldatei aus 13.3 (Import, Heute relevant, Aufnehmen, Einschätzung, Autor übernehmen, Pressespiegel erstellen, Kachel), Artikel von Hand; PWA (Manifest, Service Worker, `/api/health`), Push einrichten mit mehreren Geräten, Verwaltung (Einstellungen, Integrationen, Kennzahlen, Protokoll), Smartphone-Ansicht von Dashboard, Freigabe und Kontaktanfragen |

Integrationstests laufen mit fester Uhr (Dienstag, 20.10.2026, 10:00 Uhr), damit jede Priorität aus 13.5 vorkommt.

Die Tests brauchen eine PostgreSQL unter `localhost:5432` mit dem Nutzer `impress` (Recht CREATEDB), etwa `docker compose up -d db`. Sie legen eigene Datenbanken `impress_test` und `impress_e2e` an und setzen nur diese zurück; die Entwicklungsdatenbank bleibt unberührt. Für Playwright einmalig `npx playwright install chromium`.

Weitere Prüfungen: `npm run typecheck`, `npm run lint`.

## Seed-Nutzer

| Name | Rolle | Kunden-Lead |
|---|---|---|
| Lars Scholtyssyk | CVD, Admin | Ground A, Rafael |
| Lukas | CVD, Admin | Covenant |
| Laura, Robin, Mika, Juliana, Hannah | Redakteur | |
| Valentin Abel | Redakteur | SAFENET (Freigaberecht) |

Mailadressen sind Platzhalter (`vorname@example.com`). Kunden: Covenant, Ground A, Rafael (aktiv), SAFENET (Onboarding). Alle Kundendaten sind erfunden und als Beispieldaten markiert. `npm run seed:clear-samples` entfernt sie, Nutzer und Grundkonfiguration bleiben.

## Externe Dienste

Jeder externe Dienst läuft über einen Adapter mit Ersatz für lokal und Tests, umschaltbar in `.env`:

| Variable | Ersatz (Standard) | Echt |
|---|---|---|
| `AUTH_PROVIDER` | `dev`: Entwickler-Login mit Seed-Nutzern | `entra`: Microsoft Entra ID |
| `DOCUMENT_STORE` | `mock`: Ordner `./storage/sharepoint-mock/` | `sharepoint`: Microsoft Graph |
| `FILE_STORAGE` | `local`: Ordner `./storage/files/` | `azure`: Azure Blob Storage |
| `AI_PROVIDER` | `mock`: Beispielantworten aus `fixtures/ai/` | `anthropic`: Claude API |
| `PUSH_PROVIDER` | `mock`: Konsolenausgabe | `webpush`: Web Push mit VAPID |
| `MONITORING_SOURCE` | `sample`: Beispieldatei aus `fixtures/monitoring/` (ab Phase 5) | `file`: hochgeladener Meltwater-Export (Standard) |

Alle echten Adapter sind umgesetzt und prüfen ihre Zugangsdaten; welche Variablen sie brauchen, steht in [OPERATIONS.md](OPERATIONS.md). Den Zustand zeigen `/api/health` und die Verwaltung (Integrationen und KI). Der Entwickler-Login ist bei `NODE_ENV=production` gesperrt.

## Projektstruktur

```
/app            Seiten und Route Handlers
/components     Oberfläche, nach Bereich gegliedert
/lib/domain     Geschäftslogik je Bereich, Rechteprüfung in /lib/domain/permissions
/lib/adapters   Schnittstellen und Implementierungen (echt + Ersatz)
/lib/ai         ai-service, Schemas
/prompts        versionierte Prompts
/jobs           Hintergrundjobs (Worker: npm run worker)
/prisma         Schema, Migrationen, Seed
/fixtures       Beispieldateien und KI-Beispielantworten
/tests          Vitest und Playwright
/i18n           Oberflächentexte Deutsch, eine Datei pro Bereich
```

## Was man in Phase 1 ausprobieren kann

- **Als Laura (Redakteurin):** Dashboard mit eigener Aufgabe, „Neue Aufgabe“ nur für sich selbst, Redaktion als Liste und Tafel, Dienstplan nur lesen.
- **Als Lukas oder Lars (CVD):** „Wartet auf meine Freigabe“ mit der PM Standortentscheidung, Warnungen (Covenant im Rückstand, Ground A Compliance, Rafael Profil), Team-Ansicht, Aufgaben für andere anlegen, auf Dringend hochstufen, Dienstplan pflegen und kopieren, Verwaltung mit Nutzern, Zusatzrechten und Protokoll.
- **Als Valentin Abel (Kunden-Lead SAFENET):** Aufgaben für andere nur bei SAFENET.
- Wer eine Aufgabe zugewiesen bekommt, sieht sie in der Glocke; dringende Zuweisungen erscheinen zusätzlich als Push (lokal in der Konsole).

## Was man in Phase 2 ausprobieren kann

- **Als Laura:** „Neue Aufgabe“ → Dokument, Pressemitteilung → der Editor öffnet sich mit den Bausteinen. Schreiben, nach 5 Sekunden ist gespeichert. Links „Freigabe anfragen“.
- **Als Lukas (in einem zweiten Browser):** auf dem Dashboard „Wartet auf meine Freigabe“ öffnen. Lukas übernimmt die Prüfung, seine Änderungen erscheinen grün bzw. durchgestrichen mit Namen. „Freigeben“ oder „Änderungen anfordern“.
- **Wieder als Laura:** „Versenden“, Word oder PDF herunterladen (RP- oder Kundenvorlage), Empfänger und Kanal eintragen. Beim Kunden kann sie einen Rückläufer hochladen. Nach dem Versand an Medien liegt die Word-Datei unter `storage/sharepoint-mock/impress/Kunden/<Kunde>/…`.
- Öffnen zwei Personen denselben Text, sieht die zweite „… bearbeitet gerade“ und kann die Bearbeitung anfordern.
- Redaktion → „Projekte“ (mit gewähltem Kunden), Verwaltung → „Darstellungsformen“.

## Was man in Phase 3 ausprobieren kann

- **Kunden → Ground A → Kundenprofil öffnen:** alle Abschnitte mit „bestätigt am“, Compliance rot (13 Monate alt). Als Laura nur „Änderung vorschlagen“, als Lars bearbeiten, bestätigen, Vorschläge annehmen.
- **Als Valentin Abel: Kunden → SAFENET → Onboarding fortsetzen.** `fixtures/clients/safenet/unternehmensbeschreibung.pdf` hochladen, Vorschläge je Abschnitt annehmen, „Fragen erzeugen“, Antworten geben, später weitermachen. Als Lars „Auf Aktiv setzen“: geht erst, wenn alle Pflichtabschnitte bestätigt sind.
- **Als Lukas: PM Standortentscheidung → Reiter Prüfung → Vollanalyse.** Werte, Hinweise nach Prüfschritt, Klick auf „600 neue Arbeitsplätze“ springt zur Stelle, Verwerfen mit „Für diesen Kunden nicht mehr anzeigen“ (danach im Profil unter Verwerfungsregeln).
- **Als Laura eine neue PM schreiben:** Live-Hinweise unter dem Editor, „Headline-Vorschläge“ → eine von drei wählen → hellblauer Baustein mit KI-Label; „Freigabe anfragen“ ist gesperrt, bis er übernommen ist. Reiter Kundenwissen: Fakt einfügen.
- **KI erlaubt aus** (Stammdaten eines Kunden): kein KI-Menü, Prüfung nur regelbasiert, keine Vorschläge aus Unterlagen.

Die KI antwortet lokal mit den Beispielantworten aus `fixtures/ai/` (abgestimmt auf die PM Standortentscheidung und SAFENET). Mit `AI_PROVIDER=anthropic` und `ANTHROPIC_API_KEY` läuft die echte Claude API.

## Was man in Phase 4 ausprobieren kann

- **Journo Hub als Laura:** Liste filtern (z. B. Status „Verifiziert RP“), Telefon und Mail sind verdeckt. Jana Hofmann öffnen: Telefon zeigt nur die letzten 2 Ziffern, Artikel-Historie mit 3 Artikeln. „Kontakt anfragen“ für Covenant.
- **Als Lukas:** Glocke und Journo Hub → Anfragen: „Freigeben“, „Selbst übernehmen“ oder „Ablehnen“. Danach kann Laura bei gewähltem Kunden Covenant aufdecken (steht im Protokoll) und sich als Owner eintragen.
- **Tim Neumann** hat keinen Owner: „Wer kennt jemanden bei diesem Medium“ zeigt Miriam Krause (Owner Juliana).
- **Verifizieren:** bei Stefan Lorenz fehlt das Datum des ersten Kontakts; nach dem Eintragen wird verifiziert und wer verifiziert, wird Owner.
- **Import:** Journo Hub → Import mit `fixtures/contacts/kontakte_sample.csv`, `.xlsx` oder `.vcf`: Zuordnung, Vorschau mit 3 Dubletten, übernehmen.
- **Im Editor** (z. B. PM Standortentscheidung): Reiter Journalisten mit Begründungen; „Vormerken“ und beim Versand an Medien als Empfänger übernehmen.
- **Als Lars (CVD):** Journo Hub → Pflege, auf einem Kontakt „Auskunft als JSON/PDF“ und „Kontakt endgültig löschen“; Verwaltung → Nutzer → „Offboarding starten“.

## Was man in Phase 5 ausprobieren kann

- **Import als Mika:** Pressespiegel → Import mit `fixtures/monitoring/meltwater_sample.csv` (oder `.xlsx`). Die Spalten sind vorgeschlagen; nach „Importieren“: 37 Artikel, 3 gleiche zusammengefasst, 19 bekannten Autoren zugeordnet. Die Zuordnung wird für den nächsten Import gespeichert.
- **Heute relevant:** je Kunde die 10 höchsten Werte ab 50 mit Begründung (Beispielantworten der KI aus `fixtures/ai/relevance.valid.json`). Die Kundenauswahl in der Kopfzeile filtert.
- **Aufnehmen** per Häkchen; danach „Einschätzung erzeugen“, „Newshook-Pitch erzeugen“, „Autor in Journo Hub übernehmen“ und, nur bei Kunden mit Leistung LinkedIn, „LinkedIn-Kommentar erzeugen“. Die Aufgabe öffnet sich über den Link am Artikel, der Entwurf ist hellblau mit Label KI.
- **Autor übernehmen:** „Wehrtechnik: Neue Fertigung für Munition in Planung“ (Karla Weiß) ist unbekannt und wird Kontakt mit Label Pressespiegel; bei bekannten Autoren meldet impress „schon im Journo Hub“.
- **Volltext einfügen** am Artikel: wird neu bewertet und nach 30 Tagen gelöscht.
- **Pressespiegel erstellen** je Kunde: ein Dokument mit allen heute aufgenommenen Artikeln, Kurzfassung als KI-Baustein, Einschätzung als Platzhalter.
- **Alle Artikel** mit Suche und Zeitraum, **Artikel von Hand** unter Import.
- **Dashboard:** Kachel Pressespiegel (heute importiert, relevant, aufgenommen, wer Dienst hat). Die Aufgabe „Pressespiegel [Datum]“ legt der Worker zu Dienstbeginn an (Kunde „RP intern“, Frist am Diensttyp in Verwaltung → Diensttypen).

## Was man in Phase 6 ausprobieren kann

- **Profil → Push einrichten** (als beliebiger Nutzer): Anleitung passend zum Gerät. Lokal läuft Push im Ersatz-Modus: „Ersatz-Gerät registrieren“ (mehrmals für mehrere Geräte), einzeln entfernen, „Testnachricht senden“; die Nachricht steht in der Glocke und in der Konsole des Servers. Mit VAPID-Schlüsseln (`npx web-push generate-vapid-keys`, `PUSH_PROVIDER=webpush`) kommt sie echt auf dem Gerät an.
- **Als App installieren:** In Chrome oder Edge über das Installationssymbol in der Adressleiste, auf dem Telefon über „Zum Home-Bildschirm“.
- **Eskalation:** Die Seed-Aufgabe „PM Standortentscheidung“ wartet dringend auf Freigabe. Mit laufendem Worker bekommen nach 30 Minuten alle Freigabeberechtigten von Covenant eine Push-Nachricht, nach 60 der CVD vom Dienst (Glocke von Lars und Lukas). Die Zeiten stehen in Verwaltung → Einstellungen.
- **Verwaltung als Lars:** Einstellungen (Eskalationszeiten, Relevanzschwelle, Top-Artikel, RP-Vorlage), Integrationen und KI (Status aller Dienste, Modellwahl), Kennzahlen, Protokoll mit Suche, Aktion und Zeitraum.
- **Smartphone:** Browser auf Telefonbreite stellen, Dashboard, Freigabe und Journo Hub → Anfragen.
- **Betrieb:** `curl localhost:3000/api/health`; Beispieldaten entfernen mit `npm run seed:clear-samples`; Betriebs-Image mit `docker build -t impress .` (siehe [OPERATIONS.md](OPERATIONS.md)).

## Hintergrundjobs

| Job | Zeitplan (Berlin) | Zweck |
|---|---|---|
| `prioritaet-neu-berechnen` | alle 5 Minuten | Priorität aus der Frist, Push beim Übergang nach Dringend |
| `freigaben-eskalieren` | jede Minute | dringende Freigaben nach 30 und 60 Minuten (einstellbar) eskalieren |
| `archivierung` | täglich 2:30 | Aufgaben 30 Tage nach Erledigt archivieren |
| `kunden-warnungen` | täglich 7:00 | Profilwarnungen und Leistungsrückstand in die Glocke |
| `kontaktanfragen-erinnern` | stündlich | Owner einmal erinnern, wenn eine Kontaktanfrage 24 Stunden offen ist |
| `journo-pflege` | Montag 6:00 | mögliche Dubletten und Kontakte ohne Aktivität den CVDs vorlegen |
| `pressespiegel-aufgabe` | alle 15 Minuten | zu Beginn eines Pressespiegel-Dienstes die Aufgabe „Pressespiegel [Datum]“ anlegen |
| `volltexte-loeschen` | täglich 3:15 | eingefügte Volltexte nach 30 Tagen löschen |

Ohne laufenden Worker berechnen die Listen die Priorität trotzdem beim Anzeigen; nur die Benachrichtigungen des Jobs fehlen dann.

## Nützliche Befehle

| Befehl | Zweck |
|---|---|
| `npm run db:migrate -- <name>` | neue Migration aus Schemaänderungen erzeugen und anwenden |
| `npm run db:deploy` | Migrationen anwenden |
| `npm run db:seed` | Seed einspielen |
| `npm run seed:clear-samples` | Beispieldaten entfernen, Nutzer bleiben |
| `npm run user:bootstrap -- "Name" mail@…` | ersten echten CVD mit Admin-Recht anlegen (Livegang) |
| `node scripts/pwa-icons.mjs` | App-Icons neu erzeugen (z. B. mit dem RP-Logo) |
