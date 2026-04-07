# ═══════════════════════════════════════════════════════════════
# LysiaETIC Frontend — Multi-stage Production Dockerfile
# ✅ P1-4: Build + Nginx serve, gzip, SPA routing
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Build ─────────────────────────────────────────────
FROM node:18-alpine AS build
WORKDIR /app

# Bağımlılıkları önce kopyala (cache layer)
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# Uygulama kodunu kopyala ve build et
COPY . .

# Build-time environment variables
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV CI=false
ENV NODE_OPTIONS=--openssl-legacy-provider

RUN npm run build

# ── Stage 2: Nginx Serve ──────────────────────────────────────
FROM nginx:1.25-alpine AS production
LABEL maintainer="LysiaETIC <info@lunexetic.com>"

# Özel nginx config
COPY nginx.docker.conf /etc/nginx/conf.d/default.conf

# Build çıktısını kopyala
COPY --from=build /app/build /usr/share/nginx/html

# Nginx'in PID dosyası için izin
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
