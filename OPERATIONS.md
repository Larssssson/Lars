# OPERATIONS.md – Betrieb von impress

Übergabe an den Hosting-Entwickler (BRIEFING 16). impress läuft in Azure in der EU: eine App, ein Worker für Hintergrundjobs, PostgreSQL, Azure Blob Storage für Dateien, SharePoint für finale Texte, Claude API für die KI, Web Push für Benachrichtigungen. Fachliches steht in [BRIEFING.md](BRIEFING.md), Entscheidungen in [DECISIONS.md](DECISIONS.md).

## 1. Bausteine

| Baustein | Technik | Hinweis |
|---|---|---|
| App | Next.js 16 (Node 22), `npm start` auf Port 3000 | zustandslos, mehrere Instanzen möglich |
| Worker | pg-boss, `npm run worker` | **genau eine** Instanz; Jobs und Zeitpläne liegen in PostgreSQL |
| Datenbank | PostgreSQL 16 | Azure Database for PostgreSQL (Flexible Server), EU-Region, TLS erzwungen |
| Dateien | Azure Blob Storage, privater Container | Azure verschlüsselt ruhende Daten; nie öffentlicher Zugriff |
| Ablage finaler Texte | SharePoint über Microsoft Graph | Bibliothek mit Wurzelpfad `impress/Kunden` |
| KI | Claude API (Anthropic SDK) | unter dem Vertrag von RP mit Anthropic |
| Push | Web Push mit VAPID | Service Worker `/sw.js`, Manifest `/manifest.webmanifest` |
| PDF-Export | Chromium über Playwright | im Image enthalten |

## 2. Image und Start

Das [Dockerfile](Dockerfile) baut ein Image für App, Worker und Migration. Der Build braucht Internet (npm, Chromium), aber keine Zugangsdaten.

```bash
docker build -t impress .

# 1. Migration: eigener Schritt vor jedem Start einer neuen Version
docker run --rm --env-file impress.env impress npm run db:deploy

# 2. App
docker run -d -p 3000:3000 --env-file impress.env impress

# 3. Worker (genau einer)
docker run -d --env-file impress.env impress npm run worker
```

In Azure Container Apps oder App Service entspricht das einer App (Standardbefehl), einem Worker (Befehl `npm run worker`, ohne Ingress, eine Replik) und einem Job vor dem Rollout (`npm run db:deploy`). Das Image läuft als Nutzer `node`. Der Container-Healthcheck ruft `/api/health` auf.

### Erstinstallation

```bash
docker run --rm --env-file impress.env impress npm run db:deploy
docker run --rm --env-file impress.env impress npm run db:seed            # Darstellungsformen, Diensttypen, RP intern, Beispieldaten
docker run --rm --env-file impress.env impress npm run seed:clear-samples # Beispieldaten entfernen (Abschnitt 7)
docker run --rm --env-file impress.env impress npm run user:bootstrap -- "Vorname Nachname" vorname.nachname@rudpedersen.com
```

`user:bootstrap` legt den ersten echten CVD mit Admin-Recht an (oder hebt einen vorhandenen Nutzer an). Alle weiteren Nutzer legt ein CVD in der Verwaltung an; die Anmeldung über Entra ID findet den Nutzer über die Mailadresse. Die acht Seed-Nutzer haben Beispieladressen (`@example.com`) und können sich über Entra ID nicht anmelden; ein CVD sperrt sie in der Verwaltung, wenn sie stören.

## 3. Umgebungsvariablen

Vorlage mit lokalen Standardwerten: [.env.example](.env.example). Geheimnisse (markiert mit 🔒) gehören in Azure Key Vault oder die Secrets der Container-Plattform, nie ins Image.

| Variable | Pflicht im Betrieb | Bedeutung |
|---|---|---|
| `DATABASE_URL` 🔒 | ja | PostgreSQL-Verbindung, mit `sslmode=require` |
| `AUTH_SECRET` 🔒 | ja | Schlüssel für Sitzungs-Token, mindestens 32 zufällige Zeichen (`openssl rand -base64 32`) |
| `AUTH_PROVIDER` | ja | `entra` im Betrieb; `dev` (Entwickler-Login) ist bei `NODE_ENV=production` gesperrt |
| `ENTRA_CLIENT_ID`, `ENTRA_TENANT_ID` | ja | App-Registrierung in Entra ID (Login und SharePoint) |
| `ENTRA_CLIENT_SECRET` 🔒 | ja | Geheimnis der App-Registrierung |
| `DOCUMENT_STORE` | ja | `sharepoint` im Betrieb, `mock` schreibt nach `STORAGE_DIR/sharepoint-mock` |
| `SHAREPOINT_SITE_ID`, `SHAREPOINT_DRIVE_ID` | bei `sharepoint` | Site und Dokumentbibliothek (IDs aus Graph) |
| `SHAREPOINT_ROOT_PATH` | nein | Wurzelpfad in der Bibliothek, Standard `impress/Kunden` |
| `FILE_STORAGE` | ja | `azure` im Betrieb, `local` schreibt nach `STORAGE_DIR/files` |
| `AZURE_STORAGE_CONNECTION_STRING` 🔒 | bei `azure` | Verbindung zum Speicherkonto |
| `AZURE_STORAGE_CONTAINER` | bei `azure` | privater Container, wird beim ersten Schreiben angelegt |
| `AI_PROVIDER` | ja | `anthropic` im Betrieb, `mock` liefert Beispielantworten |
| `ANTHROPIC_API_KEY` 🔒 | bei `anthropic` | Schlüssel aus dem RP-Vertrag |
| `AI_MODEL_QUALITY`, `AI_MODEL_FAST` | nein | Standardmodelle (`claude-sonnet-5-5`, `claude-haiku-5-5`); in der Verwaltung überschreibbar |
| `PUSH_PROVIDER` | ja | `webpush` im Betrieb, `mock` nur Glocke und Konsole |
| `VAPID_PUBLIC_KEY` | bei `webpush` | öffentlicher Schlüssel; einmal erzeugen mit `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` 🔒 | bei `webpush` | privater Schlüssel; ein Wechsel macht alle Geräte-Registrierungen ungültig |
| `VAPID_SUBJECT` | bei `webpush` | Kontakt für die Push-Dienste, z. B. `mailto:it@rudpedersen.com` |
| `MONITORING_SOURCE` | nein | `file` (Meltwater-Upload), `sample` nur für Vorführungen |
| `APP_BASE_URL` | ja | öffentliche Adresse mit `https://` (Links, Auth.js) |
| `TZ` | ja | `Europe/Berlin` (im Image gesetzt) |
| `STORAGE_DIR` | nein | nur für die Ersatz-Adapter, im Image `/app/storage` |
| `PLAYWRIGHT_CHROMIUM_PATH` | nein | anderer Chromium für den PDF-Export; Standard ist der im Image |
| `PORT` | nein | Port der App, Standard 3000 |

Microsoft Entra ID: Redirect-URI `https://<APP_BASE_URL>/api/auth/callback/microsoft-entra-id`, Scopes `openid profile email`. Für SharePoint braucht dieselbe App-Registrierung die Anwendungsberechtigung `Sites.Selected` (oder `Sites.ReadWrite.All`) mit Schreibrecht auf die impress-Site. Ein Mitarbeiter kann sich nur anmelden, wenn ein CVD ihn vorher mit seiner Mailadresse angelegt hat.

## 4. Hintergrundjobs

Der Worker registriert beim Start alle Jobs mit Zeitplan (Europe/Berlin). Fällt er aus, holt pg-boss verpasste Läufe nicht nach; die Listen berechnen die Priorität trotzdem beim Anzeigen.

| Job | Zeitplan | Zweck |
|---|---|---|
| `prioritaet-neu-berechnen` | alle 5 Minuten | Priorität aus der Frist, Push beim Übergang nach Dringend |
| `freigaben-eskalieren` | jede Minute | dringende Freigaben nach 30 und 60 Minuten eskalieren (einstellbar) |
| `archivierung` | täglich 2:30 | Aufgaben 30 Tage nach Erledigt archivieren |
| `kunden-warnungen` | täglich 7:00 | Profilwarnungen und Leistungsrückstand in die Glocke |
| `kontaktanfragen-erinnern` | stündlich | Owner an unbeantwortete Kontaktanfragen erinnern |
| `journo-pflege` | Montag 6:00 | mögliche Dubletten und inaktive Kontakte den CVDs vorlegen |
| `pressespiegel-aufgabe` | alle 15 Minuten | Aufgabe „Pressespiegel [Datum]“ zu Dienstbeginn |
| `volltexte-loeschen` | täglich 3:15 | eingefügte Volltexte nach 30 Tagen löschen |

## 5. Gesundheitsendpunkt

`GET /api/health` ohne Anmeldung, Antwort ohne Inhalte:

```json
{ "status": "ok", "checks": { "datenbank": { "ok": true, "mode": "real", "detail": "PostgreSQL erreichbar" }, "speicher": { … }, "ki": { … }, "sharepoint": { … } } }
```

- HTTP 200 mit `status: "ok"`: alles erreichbar.
- HTTP 200 mit `status: "degraded"`: Datenbank in Ordnung, ein externer Dienst gestört; impress läuft, die betroffene Funktion meldet sich in der Oberfläche. Alarm, aber kein Neustart.
- HTTP 503 mit `status: "error"`: keine Datenbank. Neustart oder Umleitung.
- Fehlende Umgebungsvariablen stehen mit Namen (nie mit Werten) im Feld `detail`.

Jede Prüfung bricht nach 5 Sekunden ab. Den Zustand aller Dienste, auch Login und Push, zeigt die Verwaltung unter „Integrationen und KI“ (nur Admin).

## 6. Sicherung, Wiederherstellung, Logs (BRIEFING 11)

- **Sicherung:** täglich Datenbank (Point-in-Time-Restore des Flexible Server, Aufbewahrung 30 Tage) und Blob-Container (Soft Delete und Versionierung je 30 Tage, oder Azure Backup für Blobs). SharePoint sichert Microsoft 365.
- **Wiederherstellung vor Livegang einmal testen:** Datenbank auf einen neuen Server zurücksetzen, App mit `DATABASE_URL` darauf starten, `/api/health` prüfen, einen Kunden und eine Aufgabe mit Anhang öffnen. Ergebnis mit Datum dokumentieren.
- **Logs:** impress schreibt keine Textinhalte, keine Kontaktdaten und keine Mailadressen ins Log, nur IDs und Zustände. Plattform-Logs (Zugriffsprotokolle) ohne Request-Bodies speichern. Aufbewahrung nach den Vorgaben der RP-Datenschutzverantwortung.
- **Protokoll in der Anwendung:** Rechteänderungen, Freigaben, Aufdecken von Kontaktdaten, Löschungen und Einstellungen stehen in der Tabelle `AuditLog`; ein Datenbank-Trigger verhindert Ändern und Löschen.
- **Verbindungen:** nur TLS (App hinter HTTPS, PostgreSQL mit `sslmode=require`, Speicher nur über HTTPS).
- **Abhängigkeiten:** monatlich aktualisieren (`npm outdated`, `npm audit`), danach `npm test` und ein neues Image.

## 7. Beispieldaten entfernen

```bash
docker run --rm --env-file impress.env impress npm run seed:clear-samples
```

Löscht alle Datensätze mit `isSampleData = true` (Kunden, Aufgaben, Dokumente, Journalisten, Artikel, Dienste …) und deren Dateien im Speicher. Nutzer, Darstellungsformen, Diensttypen und der interne Kunde „RP intern“ bleiben. Ordner, die der Seed im SharePoint angelegt hat (`impress/Kunden/<Kunde>`), löscht der Befehl nicht; sie sind leer und können bleiben oder von Hand weg.

## 8. Bekannte Grenzen und technische Schulden

| Thema | Stand | Quelle |
|---|---|---|
| Auth.js | Version 5 ist noch Beta; Wechsel betrifft nur den Adapter | D-027 |
| Gleichzeitiges Schreiben | Bearbeitungssperre und Mitlesen alle 5 Sekunden, keine Echtzeit-Zusammenarbeit | D-063 |
| Änderungsverfolgung | Struktur (Absätze, Listen, Tabellen) wird ausgeführt, aber nicht markiert | D-062 |
| Push-Kennzahl | höchstens drei Push pro Person und Tag wird gemessen, nicht erzwungen | D-034 |
| Worker | eine Instanz; verpasste Zeitpläne werden nicht nachgeholt | D-030 |
| Kennzahl „aktive Nutzer“ | zählt Tage mit Nutzung ab Phase 6, keine Werte davor | D-115 |
| Kennzahl „verifizierte Kontakte“ | Stand heute rückgerechnet aus dem Verifizierungsdatum; gelöschte oder entzogene Verifizierungen fehlen in früheren Monaten | D-115 |
| Echte Dienste | gegen Azurite und Mock-Server getestet, nicht gegen die RP-Umgebung (keine Zugangsdaten im Bau) | D-114 |
| RP-Vorlage | Platzhalter-Logo, Farbe und Schrift, bis RP sie liefert (in der Verwaltung einstellbar); die Schriftdatei TT Hoves Pro ist nicht eingebunden, PDF nutzt eine Systemschrift | D-116 |
| Paketprüfung | `npm audit` meldet mittlere Lücken in `uuid` (über exceljs) und `sprintf-js` (über mammoth); betroffene Funktionen nutzt impress nicht, bei neuen Versionen aktualisieren | D-117 |
| Image-Größe | ein Image für App, Worker und Migration mit Chromium, rund 2 GB | D-117 |

## 9. Was RP vor dem Livegang bereitstellt (BRIEFING 16)

- [ ] App-Registrierung in Entra ID (Login) und Berechtigung für die SharePoint-Site
- [ ] SharePoint-Site und Bibliothek für `impress/Kunden`
- [ ] Azure-Abonnement in der EU für App, Datenbank und Dateispeicher
- [ ] Claude-API-Schlüssel über den RP-Vertrag
- [ ] RP-Logo, Schriftdatei TT Hoves Pro mit Weblizenz, Farbwert des hellen RP-Blaus
- [ ] ein echter Meltwater-Export zur Prüfung der Spaltenzuordnung
- [ ] Durchsicht des Journo Hub durch die Datenschutzverantwortung von RP
- [ ] echte Kundenprofile für Covenant, Ground A, Rafael und SAFENET über das Onboarding

## 10. Checkliste Livegang

1. Umgebungsvariablen gesetzt, `AUTH_PROVIDER=entra`, alle Adapter echt.
2. `npm run db:deploy`, `npm run db:seed`, `npm run seed:clear-samples`, `npm run user:bootstrap`.
3. App und genau ein Worker laufen; `/api/health` meldet `ok`.
4. Verwaltung → Integrationen und KI: alle Dienste „echt“ und „in Ordnung“.
5. Verwaltung → Einstellungen: RP-Vorlage (Logo, Farbe, Schrift), Eskalationszeiten, Relevanzschwelle.
6. Profil → Push einrichten auf einem Telefon und einem Rechner, Testnachricht kommt an.
7. Eine Pressemitteilung bis zur Ablage im SharePoint durchspielen, Datei liegt im Kundenordner.
8. Wiederherstellung der Sicherung einmal getestet (Abschnitt 6).
