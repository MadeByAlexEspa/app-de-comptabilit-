FROM node:20-alpine AS builder

WORKDIR /build

# Install & build client
COPY ["app de comptabilité/client/package.json", "app de comptabilité/client/package-lock.json", "./client/"]
RUN cd client && npm ci

COPY ["app de comptabilité/client/", "./client/"]
RUN cd client && npm run build

# Install server deps
COPY ["app de comptabilité/server/package.json", "app de comptabilité/server/package-lock.json", "./server/"]
RUN cd server && npm ci --production

COPY ["app de comptabilité/server/", "./server/"]

# ── Runtime image ──────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /build/server ./server
COPY --from=builder /build/client/dist ./client/dist

RUN mkdir -p /data

ENV NODE_ENV=production
ENV DB_PATH=/data/compta.db

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server/src/index.js"]
