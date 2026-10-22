#!/usr/bin/env bash
# Startet impress in GitHub Codespaces im Hintergrund und meldet, wann es bereit ist (README).
# Läuft bei jedem Öffnen des Codespace; mehrfaches Ausführen schadet nicht.
set -u
cd "$(dirname "$0")/.."
LOG=/tmp/impress-dev.log
LOCAL=http://localhost:3000
if [ -n "${CODESPACE_NAME:-}" ]; then
  PUBLIC="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  # Server Actions von der weitergeleiteten Adresse erlauben (next.config.ts),
  # Login leitet auf die öffentliche Adresse statt auf localhost zurück (Auth.js)
  export ALLOWED_FORWARDED_HOSTS="${ALLOWED_FORWARDED_HOSTS:-*.app.github.dev}"
  export AUTH_URL="$PUBLIC"
else
  PUBLIC=$LOCAL
fi

echo "impress: warte auf die Datenbank …"
node -e '
  const url = new URL(process.env.DATABASE_URL || require("fs").readFileSync(".env", "utf8").match(/^DATABASE_URL=(.*)$/m)[1]);
  const net = require("net");
  const end = Date.now() + 120000;
  (function tryOnce() {
    const s = net.connect(Number(url.port || 5432), url.hostname, () => { s.end(); process.exit(0); });
    s.on("error", () => (Date.now() > end ? process.exit(1) : setTimeout(tryOnce, 1000)));
  })();
' || { echo "impress: Die Datenbank ist nicht erreichbar. Bitte den Codespace neu starten."; exit 1; }

echo "impress: Datenbank einrichten und Beispieldaten einspielen …"
if ! npm run setup >> "$LOG" 2>&1; then
  echo "impress: Die Einrichtung ist fehlgeschlagen. Letzte Zeilen aus $LOG:"
  tail -40 "$LOG"
  exit 1
fi

if [ -n "${CODESPACE_NAME:-}" ]; then
  # in Codespaces immer frisch starten, damit die Einstellungen oben gelten
  pkill -f "next dev" 2>/dev/null && sleep 2
fi
if curl -s -m 5 -o /dev/null "$LOCAL/api/health"; then
  echo "impress: läuft bereits."
else
  echo "impress: starte …"
  # eigene Prozessgruppe: der Server läuft weiter, wenn Terminal oder Codespaces-Startbefehl enden
  setsid nohup npm run dev -- -H 0.0.0.0 >> "$LOG" 2>&1 < /dev/null &
fi

echo "impress: lade die erste Seite vor (beim ersten Mal 1 bis 3 Minuten) …"
code=000
for _ in $(seq 1 60); do
  code=$(curl -s -m 120 -o /dev/null -w "%{http_code}" "$LOCAL/login")
  [ "$code" = "200" ] && break
  sleep 3
done

if [ "$code" = "200" ]; then
  echo ""
  echo "================================================================"
  echo "  impress ist bereit: $PUBLIC"
  echo "  (Link mit Strg/Cmd + Klick öffnen, dann einen Nutzer wählen)"
  echo "================================================================"
else
  echo "impress: antwortet nicht (Status $code). Letzte Zeilen aus $LOG:"
  tail -40 "$LOG"
  exit 1
fi
