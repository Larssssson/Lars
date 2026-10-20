#!/usr/bin/env bash
# Neue Migration aus Schemaänderungen erzeugen, ohne interaktives `prisma migrate dev`.
# Vergleicht die (auf Stand gebrachte) Entwicklungsdatenbank mit prisma/schema.prisma.
# Aufruf: npm run db:new-migration -- <name>
set -euo pipefail
name="${1:?Name der Migration angeben, z. B. npm run db:new-migration -- aufgaben_anhaenge}"
npx prisma migrate deploy >/dev/null
dir="prisma/migrations/$(date -u +%Y%m%d%H%M%S)_${name}"
sql="$(npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script)"
if ! grep -qvE '^\s*(--.*)?$' <<<"$sql"; then
  echo "Keine Schemaänderung gefunden."
  exit 0
fi
mkdir -p "$dir"
printf '%s\n' "$sql" > "$dir/migration.sql"
npx prisma migrate deploy
npx prisma generate >/dev/null
echo "Migration angelegt: $dir"
