# Demo-Server bei Render einrichten

Ein Demo-Server zeigt impress mit erfundenen Beispieldaten unter einem festen Link, ohne Codespaces und ohne Installation. Eine ganze Seite ist durch ein gemeinsames Passwort geschützt; danach wählt man eine Beispielperson (DECISIONS D-122). Für echte Kunden- oder Kontaktdaten ist er nicht gedacht: dafür gibt es die Testumgebung in Azure mit Microsoft-Login (OPERATIONS.md).

Render legt aus der Datei `render.yaml` im Repository alles selbst an: den Dienst (App und Hintergrundjobs) in Frankfurt und die Datenbank.

## Was du brauchst

- Dein GitHub-Konto (mit Zugriff auf das Repository `Larssssson/Lars`).
- Eine Kreditkarte für Render. Kosten laut Vorlage: Dienst `1c-2g` und Datenbank `0.1c-256mb`, zusammen rund 30 US-Dollar im Monat (aktuelle Preise zeigt Render vor dem Anlegen). Abgerechnet wird nur, solange der Dienst läuft.
- Ein Passwort für die Demo, mindestens 10 Zeichen. Es gilt für alle, denen du den Link gibst.

## Einrichten (einmalig, etwa 15 Minuten)

1. **Konto anlegen:** https://dashboard.render.com öffnen und **„Sign up with GitHub“** wählen.
2. **Vorlage starten:** Oben auf **„New“** → **„Blueprint“** klicken.
3. **Repository wählen:** Bei der ersten Nutzung **„Connect GitHub“** bzw. **„Configure account“** klicken und Render den Zugriff auf `Larssssson/Lars` erlauben. Danach in der Liste **`Larssssson/Lars`** auswählen und **„Connect“** klicken.
4. **Namen vergeben:** Als „Blueprint Name“ z. B. `impress-demo` eintragen. Branch: `main`.
5. **Passwort eintragen:** Render zeigt die Dienste aus der Vorlage (`impress-demo`, `impress-demo-db`) und fragt nach **`DEMO_PASSWORD`**. Dort dein Demo-Passwort eintragen.
6. **Anlegen:** Auf **„Deploy Blueprint“** (oder „Apply“) klicken und, falls gefragt, die Zahlungsdaten hinterlegen.
7. **Warten:** Der erste Aufbau dauert 10 bis 20 Minuten. Unter **„impress-demo“ → „Events“** steht am Ende **„Deploy live“**.
8. **Öffnen:** Oben auf der Seite von `impress-demo` steht der Link, etwa `https://impress-demo.onrender.com`. Öffnen, im Passwort-Fenster einen beliebigen Namen und das Demo-Passwort eingeben, dann eine Beispielperson wählen (z. B. „Lars“).

Den Link und das Passwort kannst du ans Team geben.

## Im Alltag

- **Neue Versionen:** Jede Änderung im Zweig `main` baut Render automatisch neu auf (etwa 10 Minuten). Was in der Demo angelegt wurde, bleibt in der Datenbank erhalten; hochgeladene Dateien gehen bei einem Neuaufbau verloren.
- **Passwort ändern:** `impress-demo` → **„Environment“** → `DEMO_PASSWORD` ändern → **„Save Changes“**. Render startet neu.
- **Pausieren (keine Kosten für den Dienst):** `impress-demo` → **„Settings“** → ganz unten **„Suspend Web Service“**. Wieder starten mit **„Resume“**. Die Datenbank kostet weiter, bis sie gelöscht wird.
- **Ganz entfernen:** Unter **„Blueprints“** → `impress-demo` → **„Delete Blueprint“**, danach Dienst und Datenbank löschen.
- **Läuft er?** `https://<dein-link>/api/health` zeigt `"status":"ok"` (ohne Passwort erreichbar, ohne Inhalte).

## Was der Demo-Server anders macht

- Anmeldung mit Beispielpersonen statt Microsoft-Login, nur weil `DEMO_MODE=true` gesetzt ist und ein Passwort davor steht. Ohne Demo-Modus verweigert impress im Betrieb den Entwickler-Login weiterhin.
- Ein Hinweisbalken oben: „Demo mit erfundenen Beispieldaten“.
- KI, SharePoint, Dateispeicher und Push laufen mit den Ersatz-Adaptern: feste Beispielantworten der KI, Ablage im Dateisystem des Servers, Push nur in der Glocke.
- Hintergrundjobs (Priorität, Eskalation, Pressespiegel-Aufgabe) laufen im selben Dienst.
