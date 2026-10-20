#!/usr/bin/env bash
# SessionStart-Hook für Claude-Code-Cloud-Sitzungen: Abhängigkeiten, lokale PostgreSQL, Migrationen, Seed.
# Läuft nur in der Cloud (CLAUDE_CODE_REMOTE=true); lokal passiert nichts.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}"

if command -v pg_ctlcluster >/dev/null 2>&1; then
  pg_ctlcluster 16 main start 2>/dev/null || true
  su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='impress'\"" | grep -q 1 \
    || su postgres -c "psql -c \"CREATE ROLE impress LOGIN PASSWORD 'impress' CREATEDB;\""
  su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='impress'\"" | grep -q 1 \
    || su postgres -c "createdb -O impress impress"
fi

[ -f .env ] || cp .env.example .env
npm install --no-audit --no-fund >/dev/null
npm run setup >/dev/null
echo "impress: Abhängigkeiten installiert, Datenbank migriert und geseedet."
