# WattsNew: single-container app — Next.js reader + in-process news curator
# (started from instrumentation.ts). Multi-stage build → small standalone runtime.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app

# Headless Chromium for the article reader's fallback (sites that block server
# fetches), plus tzdata so the curator's cron resolves the configured TZ.
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont tzdata \
 && (test -e /usr/bin/chromium-browser || ln -s /usr/bin/chromium /usr/bin/chromium-browser)

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/data
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Next.js standalone output: server.js + traced node_modules, plus static assets.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
