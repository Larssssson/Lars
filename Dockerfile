# syntax=docker/dockerfile:1
# Betriebs-Image von impress (BRIEFING 16). Ein Image, drei Befehle:
#   Migration (eigener Schritt vor dem Start):  docker run --rm --env-file … impress npm run db:deploy
#   App (Standard):                            docker run -p 3000:3000 --env-file … impress
#   Worker (Hintergrundjobs):                  docker run --env-file … impress npm run worker
# Details: OPERATIONS.md

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
# Platzhalter nur für den Build: es wird keine Verbindung aufgebaut, Zugangsdaten kommen erst zur Laufzeit
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
 && DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build \
 && npm prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Europe/Berlin \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    STORAGE_DIR=/app/storage
COPY --from=build /app/node_modules ./node_modules
# Chromium für den PDF-Export (BRIEFING 10.1) samt Systembibliotheken
RUN npx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/* /tmp/*
COPY --from=build /app/package.json /app/package-lock.json /app/prisma.config.ts /app/next.config.ts /app/tsconfig.json ./
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/lib ./lib
COPY --from=build /app/jobs ./jobs
COPY --from=build /app/i18n ./i18n
COPY --from=build /app/prompts ./prompts
COPY --from=build /app/fixtures ./fixtures
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
