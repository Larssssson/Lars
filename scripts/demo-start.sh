#!/usr/bin/env bash
# Start des Servers bei Render (DECISIONS D-122, D-131): Migrationen, Beispieldaten oder Live-Test, Worker und App in einem Dienst.
set -euo pipefail
cd "$(dirname "$0")/.."
# Login leitet auf die öffentliche Adresse zurück (Render setzt RENDER_EXTERNAL_URL)
export AUTH_URL="${AUTH_URL:-${RENDER_EXTERNAL_URL:-}}"
export APP_BASE_URL="${APP_BASE_URL:-${RENDER_EXTERNAL_URL:-http://localhost:3000}}"
mkdir -p "${STORAGE_DIR:-/app/storage}"

echo "impress-demo: Migrationen …"
npx prisma migrate deploy
if [ "${IMPRESS_LIVE:-false}" = "true" ]; then
  # Live-Test (DECISIONS D-131): keine Beispieldaten, einmal leeren, Startpasswörter
  echo "impress-live: Konfiguration, Leeren, Passwörter …"
  npx tsx scripts/live-start.ts
else
  echo "impress-demo: Beispieldaten (mehrfaches Einspielen ändert nichts) …"
  npx tsx prisma/seed.ts
fi
echo "impress-demo: Worker für Hintergrundjobs …"
npx tsx jobs/worker.ts &
echo "impress-demo: App …"
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
