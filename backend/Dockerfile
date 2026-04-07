# ═══════════════════════════════════════════════════════════════
# LysiaETIC Backend — Production Dockerfile
# ✅ P1-4: Multi-stage build, non-root user, health check
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Dependencies ──────────────────────────────────────
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 2: Production ───────────────────────────────────────
FROM node:18-alpine AS production
LABEL maintainer="LysiaETIC <info@lunexetic.com>"

# Güvenlik: non-root kullanıcı
RUN addgroup -g 1001 -S lysiaetic && \
    adduser -S lysiaetic -u 1001 -G lysiaetic

WORKDIR /app

# Bağımlılıkları kopyala
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Uygulama kodunu kopyala
COPY . .

# Log dizinini oluştur ve izinleri ayarla
RUN mkdir -p logs && chown -R lysiaetic:lysiaetic /app

# Non-root kullanıcıya geç
USER lysiaetic

# Port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/status || exit 1

# Başlat
CMD ["node", "server.js"]
