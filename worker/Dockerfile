# Worker: RSS news curator. Runs a cron loop on the configured schedule (CRON)
# and can also run once via `docker compose run --rm worker npm run run-once`.
FROM node:24-alpine

# tzdata so the cron resolves the configured timezone (TZ) correctly.
RUN apk add --no-cache tzdata

WORKDIR /app

# Install deps first for better layer caching. tsx/typescript are dev deps but
# are needed to run the TypeScript entrypoint, so install everything.
COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
ENV DATA_DIR=/data

CMD ["npm", "start"]
