# CLAUDE.md – impress

impress ist die interne Presse- und Content-Plattform von Rud Pedersen Berlin. Verbindliche Quelle für alles Fachliche und Technische ist **[BRIEFING.md](BRIEFING.md)**. Bei Abweichungen zwischen eigenen Vorlieben und dem Briefing gilt das Briefing. Entscheidungen, die das Briefing offen lässt, stehen in **[DECISIONS.md](DECISIONS.md)**; vor jeder neuen Entscheidung dort nachsehen.

## Arbeitsregeln (Briefing Abschnitt 0, ergänzt durch Lars)

1. Strikt in der Reihenfolge der Bauphasen aus Abschnitt 12 bauen. Eine Phase ist erst fertig, wenn alle Abnahmekriterien erfüllt und durch automatisierte Tests abgedeckt sind. Tests laufen lassen, bevor eine Phase als fertig gemeldet wird.
2. Wo das Briefing einen Standardwert nennt, ihn nehmen. Wo es nichts regelt: die einfachste Entscheidung, die zu den Grundsätzen passt, und in DECISIONS.md festhalten (Datum, Frage, Entscheidung, Begründung in einem Satz).
3. Was den Bau blockiert, Lars fragen. Erweist sich ein Abschnitt beim Bauen als unpraktisch: nicht still etwas anderes bauen, sondern Lars schreiben, was nicht passt, und eine Lösung vorschlagen.
4. Alle Oberflächentexte auf Deutsch, zentral in `/i18n` (eine Datei pro Bereich). Keine Texte hart im Code.
5. Externe Dienste (Microsoft-Login, SharePoint, Blob, Claude API, Push, Monitoring) nur über Adapter mit Ersatzimplementierung (10.2), umschaltbar per Umgebungsvariable. impress läuft lokal ohne jede Zugangsdaten.
6. Nie Zugangsdaten, Schlüssel, Passwörter oder echte Personendaten in Code, Commits oder Logs. Logs ohne Textinhalte und ohne Kontaktdaten.
7. Beispieldaten aus Abschnitt 13 sind erfunden. Seeds und Fixtures genau wie dort beschrieben; jeder Seed-Datensatz außer Nutzern trägt `isSampleData = true`.
8. Am Ende jeder Phase: README, CHANGELOG.md und DECISIONS.md aktualisieren, Migrationen und Seeds lauffähig halten, Commit mit klarer Nachricht, Push auf den Arbeitszweig, kurzer Bericht an Lars (was gebaut ist, Abnahmekriterien abgehakt oder offen, Testergebnis, wie man es lokal ausprobiert). Dann auf Lars' OK für die nächste Phase warten.

## Grundsätze (Briefing Abschnitt 2, entscheiden im Zweifel)

1. Der Mensch schreibt, die KI hilft. Nie komplette Texte erzeugen, nur Hinweise, Bausteine (Headline, Zitat) und Vorschläge.
2. KI-Inhalte sind immer erkennbar: farbig markiert mit Label KI, bis ein Mensch sie ausdrücklich annimmt.
3. Vier Augen sehen jeden Text, der das Haus verlässt. Niemand gibt seinen eigenen Text frei, auch kein CVD (Ausnahme nur über das Zusatzrecht Selbstfreigabe, jede Nutzung markiert).
4. Nichts geht automatisch nach draußen, weder an Kunden noch an Journalisten.
5. Der Kunde ist ein Filter, kein eigener Ort. Die Kundenauswahl in der Kopfzeile filtert alle Bereiche, bleibt beim Wechsel erhalten und wird pro Nutzer gespeichert.
6. Ein Arbeitsablauf ohne Brüche: neben dem Text sieht man Prüfung, passende Journalisten und Kundenwissen.
7. Push nur, wenn es brennt. Alles andere nur in der Glocke.
8. Herkunft ist immer sichtbar: wer hat angelegt, verifiziert, geändert, freigegeben; Quelle KI, Pressespiegel, Import oder Mensch.
9. So wenig Daten wie nötig. Keine Verträge, Honorare, Passwörter, keine fremden Volltexte auf Dauer.

## Harte Regeln aus dem Briefing, die überall gelten

- Rechteprüfung ausschließlich serverseitig in `/lib/domain/permissions`. Jede Server Action und jeder Route Handler ruft sie auf. Die Oberfläche blendet nur aus, sie schützt nicht.
- Alle KI-Aufrufe nur über `/lib/ai` (ai-service). Prompts versioniert in `/prompts`, Ausgaben mit Zod geprüft, Modell und Promptversion gespeichert, nie Telefonnummern oder Mailadressen an die KI, `aiAllowed = false` sperrt jeden Aufruf für den Kunden.
- Zeiten in UTC speichern, in Europe/Berlin anzeigen. Werktage: Mo bis Fr ohne Berliner Feiertage.
- Jede Tabelle hat `id` (UUID), `createdAt`, `createdBy`, `updatedAt`, `updatedBy`.
- Sicherheitsrelevante Aktionen (Rechteänderungen, Freigaben, Selbstfreigaben, Aufdecken von Kontaktdaten, Löschungen) ins AuditLog; Einträge sind unveränderlich.

## Stack (Briefing 10.1, aktuelle stabile Versionen)

| Bereich | Wahl |
|---|---|
| Sprache | TypeScript, strikt |
| Web und Server | Next.js (App Router), Server Actions und Route Handlers |
| Oberfläche | React, Tailwind CSS, shadcn/ui; Hell- und Dunkelmodus nach System; WCAG AA, Tastaturbedienung |
| Datenbank | PostgreSQL, Prisma, Migrationen im Repository |
| Hintergrundjobs | pg-boss (eigener Worker-Prozess) |
| Editor | TipTap/ProseMirror, nur Open-Source-Erweiterungen; Änderungsverfolgung und Kommentaranker als eigene Erweiterungen |
| Word-Import / -Export | mammoth / docx |
| PDF-Export | HTML-Vorlage, gerendert mit Playwright (Chromium) |
| Kontaktimport | papaparse, SheetJS, vCard-Parser, libphonenumber-js |
| Login | Auth.js mit Microsoft Entra ID; lokal Entwickler-Login mit Seed-Nutzern |
| SharePoint | Microsoft Graph |
| KI | Anthropic SDK |
| Push | web-push (VAPID), Service Worker, Web App Manifest |
| Dateien | Azure Blob, lokal Dateisystem, gemeinsame Schnittstelle |
| Validierung | Zod |
| Tests | Vitest (Einheit, Integration), Playwright (Ende zu Ende) |
| Lokal | Docker Compose (App, PostgreSQL) |

Konkrete Versionen und Abweichungen: siehe DECISIONS.md.

## Projektstruktur (Briefing 10.5)

```
/app            Seiten und Route Handlers
/components     Oberfläche, nach Bereich gegliedert
/lib/domain     Geschäftslogik je Bereich (tasks, documents, approvals, journo, monitoring,
                clients, shifts, notifications, permissions)
/lib/adapters   Schnittstellen und Implementierungen (echt + Ersatz)
/lib/ai         ai-service, Schemas
/prompts        versionierte Prompts
/jobs           Hintergrundjobs
/prisma         Schema, Migrationen, Seed
/fixtures       Beispieldateien und KI-Beispielantworten
/tests          Vitest und Playwright
/i18n           Oberflächentexte Deutsch
```

## Arbeitsumgebung

- In der Cloud-Sitzung kann Docker keine Images bauen (kein Netz im Build); PostgreSQL 16 ist lokal installiert und wird für Tests direkt genutzt. Docker Compose ist für die lokale Nutzung durch das Team.
- Ein SessionStart-Hook (`scripts/claude-session-start.sh`) startet in Cloud-Sitzungen PostgreSQL, installiert Pakete und spielt Migrationen und Seed ein.
- `prisma migrate reset` ist für KI-Agenten gesperrt und wird nicht umgangen. Tests setzen nur ihre eigenen Datenbanken `impress_test` und `impress_e2e` zurück (`tests/test-db.ts`).
- Next.js 16 weicht von älterem Wissen ab: vor Änderungen an Routing, Caching oder Konfiguration die Doku in `node_modules/next/dist/docs/` lesen (siehe AGENTS.md).
- Prisma 7: Client wird nach `lib/generated/prisma` erzeugt, Import aus `@/lib/generated/prisma/client`, Datenbankzugang über `@/lib/db`.
- Befehle: `npm test` (alle Tests), `npm run typecheck`, `npm run lint`, `npm run setup` (Client, Migrationen, Seed), `npm run db:migrate -- <name>` (neue Migration; `prisma migrate dev` verweigert nicht-interaktiv).
- Fachlogik bekommt ihre Abhängigkeiten als `Deps` (`lib/domain/deps.ts`, Uhr austauschbar); Server Actions bauen sie mit `serverDeps()`, Jobs mit `jobDeps()`. Integrationstests nutzen `tests/integration/helpers.ts` (feste Uhr, `resetAndSeed`).
- Editor: gemeinsame Erweiterungen in `lib/editor/` (Server und Browser, ohne DOM testbar), Browser-Teile in `components/editor/`. Änderungsverfolgung ist ein eigenes ProseMirror-Plugin (`lib/editor/track-changes.ts`), die saubere Fassung entsteht aus dem JSON (`lib/editor/content.ts`). Editor-JSON vor Server Actions mit `JSON.parse(JSON.stringify(...))` in einfaches JSON wandeln (TipTap-Attribute haben keinen Prototyp).
- Git: Entwicklung auf dem zugewiesenen Arbeitszweig, keine Pull Requests ohne ausdrücklichen Auftrag.
- KI: Fachlogik ruft nur `callAi(deps, "<funktion>", { clientIds, vars })` aus `lib/ai/service.ts`; neue Funktion = Prompt in `prompts/<name>.md` (mit `version`), Schema in `lib/ai/schemas.ts`, Eintrag in `lib/ai/functions.ts`, gültige und ungültige Beispielantwort in `fixtures/ai/`.
- Prüfung: Strukturregeln in `lib/domain/documents/structure-check.ts` (ohne Server-Abhängigkeiten, auch für Live-Hinweise im Browser), Ablauf in `lib/domain/documents/check.ts`; KI-Bausteine in `lib/domain/documents/ai-blocks.ts`, Markierung `aiInsertion` in `lib/editor/extensions.ts`.
- Kundenprofil: Abschnitte und Felder zentral in `lib/domain/clients/profile-sections.ts`, Logik in `lib/domain/clients/profile.ts`.
- Journo Hub: Fachlogik in `lib/domain/journo/` (contacts, queries, requests, import, maintenance, privacy, suggestions), Offboarding in `lib/domain/permissions/offboarding.ts`. Kontaktdaten nie in Listen, Logs, Push-Texten oder an die KI; Aufdecken nur über `revealDetail` (protokolliert).
- Pressespiegel: Fachlogik in `lib/domain/monitoring/` (`articles.ts` Import und Volltext, `relevance.ts` Bewertung, Ansichten, Kachel, `actions.ts` Aktionen, Pressespiegel-Dokument, Dienst-Aufgabe). Interner Kunde „RP intern“ (`Client.isInternal`, `internalClientId` in `lib/domain/clients/internal.ts`) trägt Aufgaben ohne echten Kunden; Kundenlisten filtern `isInternal: false`.
