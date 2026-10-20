# impress

Interne Presse- und Content-Plattform von Rud Pedersen Berlin. Die verbindliche Bauanleitung steht in [BRIEFING.md](BRIEFING.md), Entscheidungen zu offenen Punkten in [DECISIONS.md](DECISIONS.md), Änderungen je Phase in [CHANGELOG.md](CHANGELOG.md).

**Stand:** Phase 0 (Grundgerüst). Die Bereiche sind angelegt und zeigen, in welcher Phase sie gebaut werden.

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
| `npm run test:unit` | Vitest, Einheit | Adapter-Auswahl, Ersatz-Adapter |
| `npm run test:integration` | Vitest, Integration | Seed, Kundenauswahl, unveränderliches Protokoll, Entfernen der Beispieldaten |
| `npm run test:e2e` | Playwright, Ende zu Ende | Login, Navigation, Kundenauswahl über Bereiche und Sitzungen hinweg, Zugang zur Verwaltung |

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

Die echten Adapter prüfen bereits ihre Zugangsdaten; ihre Umsetzung folgt in Phase 6. Der Entwickler-Login ist bei `NODE_ENV=production` gesperrt.

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

## Nützliche Befehle

| Befehl | Zweck |
|---|---|
| `npm run db:migrate` | neue Migration aus Schemaänderungen erzeugen |
| `npm run db:deploy` | Migrationen anwenden |
| `npm run db:seed` | Seed einspielen |
| `npm run seed:clear-samples` | Beispieldaten entfernen, Nutzer bleiben |
