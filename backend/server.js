/**
 * server.js — LysiaETIC Backend
 *
 * ✅ dotenv en üstte yükleniyor
 * ✅ Terminal'de renkli HTTP istek / hata izleme
 * ✅ Sunucu durumu (uptime, bellek, DB) için /api/status endpoint'i
 * ✅ Global hata yakalama (unhandledRejection / uncaughtException)
 * ✅ FIX #5: CORS whitelist uygulandı
 * ✅ FIX #11: Rate limiting eklendi
 * ✅ FIX #18: Helmet.js güvenlik header'ları eklendi
 * ✅ FIX #9: db.js kullanıma alındı (dead code düzeltildi)
 * ✅ SEC #1: XSS sanitization, MongoDB injection koruması, HPP eklendi
 * ✅ P1-3: Swagger API dokümantasyonu eklendi (/api-docs)
 */

// ─── 1. ENV — EN ÜSTTE yüklenmeli (PM2 cwd'den bağımsız: backend/ kökü) ─────
const path = require("path");
const BACKEND_ROOT = __dirname;
require("dotenv").config({ path: path.join(BACKEND_ROOT, ".env") });
require("dotenv").config({ path: path.join(BACKEND_ROOT, ".env.local"), override: true });

const express        = require("express");
const mongoose       = require("mongoose");
const cors           = require("cors");
const helmet         = require("helmet");
const hpp            = require("hpp");
const mongoSanitize  = require("express-mongo-sanitize");
const dns            = require("dns");
const os             = require("os");
const fs             = require("fs");
const logger         = require("./config/logger");
const { apiLimiter }        = require("./middlewares/rateLimiter");
const { sanitizeBody }      = require("./middlewares/sanitize");
const { additionalSecurityHeaders } = require("./middlewares/securityHeaders");
const swaggerUi              = require("swagger-ui-express");
const swaggerSpec            = require("./config/swagger");

// ─── 2. Route'lar ─────────────────────────────────────────────────────────────
const hepsiburadaRoutes       = require("./routes/hepsiburadaRoutes");
const categoryRoutes          = require("./routes/categoryRoutes");
const orderRoutes             = require("./routes/ordersRoutes");
const productRoutes           = require("./routes/productsRoutes");
const authRoutes              = require("./routes/authRoutes");
const marketplaceRoutes       = require("./routes/marketplaceRoutes");
const aiRoutes                = require("./routes/aiRoutes");
const cargoRoutes             = require("./routes/cargoRoutes");
const financeRoutes           = require("./routes/finance");
const adminRoutes             = require("./routes/adminRoutes");
const dashboardRoutes         = require("./routes/dashboardRoutes");
const userRoutes              = require("./routes/userRoutes");
const analyticsRoutes         = require("./routes/analyticsRoutes");
const productManagementRoutes = require("./routes/productManagementRoutes");
const advancedProductRoutes   = require("./routes/advancedProductRoutes");
const saasAdminRoutes         = require("./routes/saasAdminRoutes");
const ciceksepetiRoutes       = require("./routes/ciceksepetiRoutes");
const amazonRoutes            = require("./routes/amazonRoutes");
const eInvoiceRoutes          = require("./routes/eInvoiceRoutes");
const paytrRoutes             = require("./routes/paytrRoutes");
const couponRoutes            = require("./routes/couponRoutes");
const adminCouponRoutes       = require("./routes/adminCouponRoutes");
const aiEngineRoutes          = require("./routes/aiEngineRoutes");
const aiChatRoutes            = require("./routes/aiChatRoutes");

const roketfyRoutes           = require("./routes/roketfyRoutes");
const notificationRoutes      = require("./routes/notificationRoutes");
const autoInvoiceRoutes       = require("./routes/autoInvoiceRoutes");
const categoryCenterRoutes    = require("./routes/categoryCenterRoutes");
const radarRoutes             = require("./routes/radarRoutes");
const autoOrderRoutes         = require("./routes/autoOrderRoutes");
// ✅ FIX #3: Webhook route'ları — pazaryeri anlık bildirim endpoint'leri
const webhookRoutes           = require("./routes/webhookRoutes");
const ticketRoutes            = require("./routes/ticketRoutes");
const clientErrorRoutes       = require("./routes/clientErrorRoutes");
const accessControlRoutes     = require("./routes/accessControlRoutes");
const seoPublicRoutes         = require("./routes/seoPublicRoutes");
const publicRoutes            = require("./routes/publicRoutes");
const storeRoutes             = require("./routes/storeRoutes");
const storeFacadeRoutes       = require("./routes/storeFacadeRoutes");
const storeInboxOAuthRoutes   = require("./routes/storeInboxOAuthRoutes");
const storePublicRoutes       = require("./routes/storePublicRoutes");
const appStoreRoutes          = require("./routes/appStoreRoutes");
const storeCustomDomainRoutes = require("./routes/storeCustomDomainRoutes");
const webStoreManagerRoutes   = require("./routes/webStoreManagerRoutes");
const websiteBuilderRoutes    = require("./routes/websiteBuilderRoutes");
const wbPublicRoutes          = require("./routes/wbPublicRoutes");
const themeStudioRoutes       = require("./theme-builder-v3/routes/themeStudioRoutes");
const wbProductBuilderRoutes  = require("./routes/wbProductBuilderRoutes");
const wbAIRoutes              = require("./routes/wbAIRoutes");
const wbAnalyticsRoutes       = require("./routes/wbAnalyticsRoutes");
const wbInternalSslRoutes     = require("./routes/wbInternalSslRoutes");

// ─── 3. DNS & App ─────────────────────────────────────────────────────────────
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const app = express();
const { canonicalHostRedirect } = require("./middlewares/canonicalHostRedirect");

// Eski domain → dashtock.com (pazaryonet.com vb.)
app.use(canonicalHostRedirect);

// ─── 4. Sunucu başlangıç zamanı (uptime için) ─────────────────────────────────
const SERVER_START = Date.now();

// ─── 5. İstek sayacı (basit in-memory) ───────────────────────────────────────
const stats = {
    total    : 0,
    success  : 0,   // 2xx
    clientErr: 0,   // 4xx
    serverErr: 0,   // 5xx
    routes   : {},  // endpoint bazlı sayaç
};

// --- FRONTEND STATIC SERVING (production: deploy ile frontend/build veya Nginx /var/www/html) ---
const buildPath = path.join(__dirname, "../frontend/build");
const buildIndexPath = path.join(buildPath, "index.html");
const hasFrontendBuild = fs.existsSync(buildIndexPath);
if (process.env.NODE_ENV === "production" && !hasFrontendBuild) {
    logger.warn(
        "⚠️ frontend/build/index.html yok — Ana site icin Nginx + deploy-frontend.ps1 gerekli. " +
        "Sadece git pull yapmak yetmez (build .gitignore'da)."
    );
}
if (hasFrontendBuild) {
    app.use(express.static(buildPath));
}
// -------------------------------

// ─── 6. GÜVENLİK — Helmet.js + Ek Güvenlik Header'ları ────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false  // Frontend SPA ile uyumluluk
}));
app.use(additionalSecurityHeaders);

// ─── 7. CORS — Whitelist bazlı (config/domain.js) ───────────────────────────
const { APP_URL, getCorsAllowedOrigins } = require("./config/domain");
const allowedOrigins = getCorsAllowedOrigins();

/** RFC1918 özel ağ: LAN'dan telefon/tablet ile test (örn. http://192.168.1.108:3000) */
function isPrivateLanOrigin(origin) {
    try {
        const u = new URL(origin);
        const protocol = u.protocol;
        if (protocol !== "http:" && protocol !== "https:") return false;
        const h = u.hostname;
        if (h === "localhost" || h === "127.0.0.1") return false;
        const p = h.split(".").map(Number);
        if (p.length !== 4 || p.some(n => Number.isNaN(n) || n < 0 || n > 255)) return false;
        const [a, b] = p;
        if (a === 10) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        return false;
    } catch {
        return false;
    }
}

const corsAllowLan =
    process.env.CORS_ALLOW_LAN === "1" ||
    process.env.CORS_ALLOW_LAN === "true" ||
    process.env.NODE_ENV !== "production";

// ✅ CORS POLİTİKASI
//   • Default davranış: BİLİNMEYEN origin'leri WARN ile loglar ama IZIN verir (soft mode)
//     → Domain seçim sürecinde IP/farklı subdomain erişim sorunu yaşamamak için
//   • CORS_STRICT=true ile sıkı mode'a geçilebilir (sadece whitelist'tekiler kabul edilir)
//   • CORS_ALLOW_ALL=true ile her şey loglanmadan kabul edilir (debug)
const corsStrict =
    process.env.CORS_STRICT === "1" ||
    process.env.CORS_STRICT === "true";
const corsAllowAll =
    process.env.CORS_ALLOW_ALL === "1" ||
    process.env.CORS_ALLOW_ALL === "true";

if (corsAllowAll) {
    logger.warn("⚠️ CORS_ALLOW_ALL aktif — tüm origin'ler sessizce kabul ediliyor");
} else if (!corsStrict) {
    logger.info("ℹ️ CORS soft mode (default) — bilinmeyen origin'ler loglanır ama kabul edilir. Sıkı mod için CORS_STRICT=true");
} else {
    logger.info("🔒 CORS strict mode — sadece whitelist'teki origin'ler kabul edilir");
}

app.use(cors({
    origin: function (origin, callback) {
        // Server-to-server istekler (origin yok) veya whitelist'teki origin'ler
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        if (corsAllowAll) {
            return callback(null, true);
        }
        if (corsAllowLan && isPrivateLanOrigin(origin)) {
            return callback(null, true);
        }
        // Bilinmeyen origin
        if (corsStrict) {
            logger.warn(`🚫 CORS ENGELLENDİ (strict) → origin="${origin}" — whitelist'te yok.`);
            return callback(new Error(`CORS policy: '${origin}' origin'ine izin verilmiyor.`));
        }
        // ✅ Soft mode: logla ama izin ver. Admin "Operasyon Defteri"nde görür ve whitelist'e ekleyebilir.
        logger.warn(`CORS engellendi: ${origin}`); // Eski log formatı (analiz scriptleri için)
        logger.warn(`⚠️ Bilinmeyen origin (soft mode'da kabul edildi): "${origin}" — kalıcı izin için CORS_EXTRA_ORIGINS'e ekleyin.`);
        return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// ─── 8. Body parser ──────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" })); // ✅ PayTR callback application/x-www-form-urlencoded gönderir

// ─── 8.0a GÜVENLİK — MongoDB Injection Koruması ────────────────────────────
// $gt, $ne gibi operatörlerin body/query/params'a enjekte edilmesini engeller
app.use(mongoSanitize({
    replaceWith: "_",
    onSanitize: ({ req, key }) => {
        logger.warn(`MongoDB injection girişimi engellendi: ${key} — IP: ${req.ip}`);
    }
}));

// ─── 8.0b GÜVENLİK — HPP (HTTP Parameter Pollution) Koruması ───────────────
// Aynı query parametresinin birden fazla gönderilmesini engeller
app.use(hpp());

// ─── 8.0c GÜVENLİK — XSS Sanitization ──────────────────────────────────────
// Tüm POST/PUT/PATCH body'lerindeki HTML/script tag'lerini temizler
app.use(sanitizeBody);

// ─── Website Builder — Caddy on-demand TLS ask (rate limit / sanitize öncesi) ─
app.use(wbInternalSslRoutes);

// ─── 8.1 Genel API Rate Limiter ──────────────────────────────────────────────
// ✅ PayTR callback ve Webhook endpoint'lerini rate limiter'dan muaf tut
// PayTR sunucusu ve pazaryeri webhook sunucuları doğrudan erişmeli
app.use("/api/", (req, res, next) => {
    if (req.originalUrl === "/api/paytr/callback" && req.method === "POST") {
        return next(); // Rate limiter atla
    }
    if (req.originalUrl === "/api/public/store/paytr/callback" && req.method === "POST") {
        return next();
    }
    // ✅ FIX #3: Webhook endpoint'leri rate limiter'dan muaf
    if (req.originalUrl.startsWith("/api/webhooks/") && req.method === "POST") {
        return next(); // Rate limiter atla — pazaryeri sunucuları erişmeli
    }
    // ✅ v3: AI Engine + AI Chat endpoint'leri rate limiter'dan muaf
    // Zaten authMiddleware + subscriptionMiddleware ile korunuyorlar
    // LysiaBrain 25 tab + polling ile çok fazla istek atıyor, cache'den okuyor zaten
    if (req.originalUrl.startsWith("/api/ai-engine/") || req.originalUrl.startsWith("/api/ai-chat/")) {
        return next();
    }
    if (req.originalUrl.startsWith("/internal/wb/ssl/")) {
        return next();
    }
    // Bloklu kullanıcı yardım talebi ve durum sorgusu — rate-limit'e takılmasın
    if (req.originalUrl.startsWith("/api/access/help") || req.originalUrl.startsWith("/api/access/my-status")) {
        return next();
    }
    apiLimiter(req, res, next);
});

// ─── 8. HTTP İSTEK LOGGER (her isteği terminale yazar) ───────────────────────
app.use((req, res, next) => {
    const startAt = Date.now();

    res.on("finish", () => {
        const ms      = Date.now() - startAt;
        const status  = res.statusCode;
        const method  = req.method.padEnd(6);
        const url     = req.originalUrl;
        const ip      = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?")
                            .toString().split(",")[0].trim();

        // İstatistik güncelle
        stats.total++;
        if (status >= 500)      stats.serverErr++;
        else if (status >= 400) stats.clientErr++;
        else                    stats.success++;

        // Endpoint sayacı
        const routeKey = `${req.method} ${req.path}`;
        stats.routes[routeKey] = (stats.routes[routeKey] || 0) + 1;

        // Renk & sembol seç
        let logFn;
        let symbol;
        if (status >= 500) {
            logFn  = (m) => logger.error(m);
            symbol = "✖";
        } else if (status >= 400) {
            logFn  = (m) => logger.warn(m);
            symbol = "⚠";
        } else if (status >= 300) {
            logFn  = (m) => logger.info(m);
            symbol = "↪";
        } else {
            logFn  = (m) => logger.http(m);
            symbol = "✔";
        }

        logFn(`${symbol} ${method} ${url}  ${status}  ${ms}ms  [${ip}]`);
    });

    next();
});

// ─── 8.2 Swagger API Dokümantasyonu ───────────────────────────────────────────
// ✅ P1-3: /api-docs adresinden erişilebilir interaktif API dokümantasyonu
// ✅ SEC: Production'da Swagger erişimi kapalı — sadece development'ta açık
if (process.env.NODE_ENV !== "production") {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: ".swagger-ui .topbar { display: none }",
        customSiteTitle: "Dashtock API Docs",
        swaggerOptions: {
            persistAuthorization: true,
            docExpansion: "none",
            filter: true,
            tagsSorter: "alpha",
        },
    }));
    // Swagger JSON endpoint (programatik erişim için)
    app.get("/api-docs.json", (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.send(swaggerSpec);
    });
} else {
    app.use("/api-docs", (req, res) => res.status(404).json({ message: "Not found" }));
    app.get("/api-docs.json", (req, res) => res.status(404).json({ message: "Not found" }));
}

// ─── 9. Route'ları bağla ──────────────────────────────────────────────────────
// SEO — robots.txt / sitemap.xml (nginx bu path'leri backend'e yönlendirir)
app.use(seoPublicRoutes);
app.use("/api/public",             publicRoutes);
app.use("/api/public/store",       storePublicRoutes);
app.use("/api/public/wb",          wbPublicRoutes);
app.use("/api/website-builder",    websiteBuilderRoutes);
app.use("/api/website-builder",    themeStudioRoutes);
app.use("/api/website-builder/sites", wbProductBuilderRoutes);
app.use("/api/website-builder/sites", wbAIRoutes);
app.use("/api/website-builder/sites", wbAnalyticsRoutes);
app.use("/api/wb/track",           wbAnalyticsRoutes);
app.use("/api/store",              storeInboxOAuthRoutes);
app.use("/api/store",              storeRoutes);
app.use("/api/ec",                 storeFacadeRoutes);
app.use("/api/apps",               appStoreRoutes);

app.use("/api/orders",             orderRoutes);
app.use("/api/products",           productRoutes);
app.use("/api/auth",               authRoutes);
app.use("/api/marketplace",        marketplaceRoutes);
// ⚠️ LEGACY: /api/ai/* — eski intelligentEngine. Aktif UI artık /api/ai-engine + /api/ai-chat kullanıyor.
//    Sadece AI_LEGACY_ENABLED=true ise mount edilir. Default: kapalı.
if (process.env.AI_LEGACY_ENABLED === "true" || process.env.AI_LEGACY_ENABLED === "1") {
    app.use("/api/ai",             aiRoutes);
    logger.info("⚠️ Legacy /api/ai/* route'u AÇIK (AI_LEGACY_ENABLED=true)");
}
app.use("/api/categories",         categoryRoutes);
// ✅ FIX: /hepsiburada → /api/hepsiburada (tutarlı prefix)
app.use("/api/hepsiburada",        hepsiburadaRoutes);
app.use("/api/cargo",              cargoRoutes);
app.use("/api/finance",            financeRoutes);
app.use("/api/admin",              adminRoutes);
app.use("/api/dashboard",          dashboardRoutes);
app.use("/api/user",               userRoutes);
app.use("/api/analytics",          analyticsRoutes);
app.use("/api/product-management", productManagementRoutes);
app.use("/api/advanced-products",  advancedProductRoutes);
app.use("/api/saas-admin",        saasAdminRoutes);
app.use("/api/ciceksepeti",       ciceksepetiRoutes);
app.use("/api/amazon",            amazonRoutes);
app.use("/api/e-invoice",        eInvoiceRoutes);
app.use("/api/paytr",            paytrRoutes);
app.use("/api/coupons",          couponRoutes);
app.use("/api/admin/coupons",    adminCouponRoutes);
app.use("/api/ai-engine",       aiEngineRoutes);
app.use("/api/ai-chat",        aiChatRoutes);
app.use("/api/roketfy",        roketfyRoutes);
app.use("/api/notifications",  notificationRoutes);
app.use("/api/auto-invoice",   autoInvoiceRoutes);
app.use("/api/category-center", categoryCenterRoutes);
app.use("/api/radar",          radarRoutes);
app.use("/api/auto-order",    autoOrderRoutes);
app.use("/api/tickets",       ticketRoutes);
app.use("/api/client-errors", clientErrorRoutes);
app.use("/api/access",         accessControlRoutes);
// ✅ FIX #3: Webhook endpoint'leri — auth gerektirmez, pazaryerlerinden gelir
app.use("/api/webhooks",       webhookRoutes);
// İade/Talep yönetimi (Trendyol Claims, HB Talep, N11 ReturnService, ÇiçekSepeti)
const claimsRoutes             = require("./routes/claimsRoutes");
app.use("/api/claims",         claimsRoutes);
// Pazaryeri webhook abonelik yönetimi (Trendyol push bildirimleri)
const integrationWebhookRoutes = require("./routes/integrationWebhookRoutes");
app.use("/api/integrations",   integrationWebhookRoutes);

// ✅ FIX #9: Eksik route bağlantıları — dosyalar var ama server.js'de bağlı değildi
const inventoryRoutes         = require("./routes/inventoryRoutes");
const brandRoutes             = require("./routes/brandRoutes");
const variantRoutes           = require("./routes/variantRoutes");
const uploadRoutes            = require("./routes/uploadRoutes");
app.use("/api/inventory",      inventoryRoutes);
app.use("/api/brands",         brandRoutes);
app.use("/api/variants",       variantRoutes);
app.use("/api/upload",         uploadRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ NEW: Custom Domain Management for Storefronts
app.use("/api/store/domain",   storeCustomDomainRoutes);

// ✅ NEW: Web Store Manager (IKAS, Ticimax, IdeaSoft, Shopify tarzı)
app.use("/api/web-store",      webStoreManagerRoutes);


// ─── 9.5 TANI ENDPOINT'LERİ — 403/CORS sorunlarını izole etmek için ─────────
// GET /api/diagnostic/whoami → kullanıcının PC'sinden çağrıldığında
//   sunucu onu nasıl gördüğünü (origin, IP, headers, CORS state) döner.
// Bu endpoint kimlik doğrulama gerektirmez ama rate limit'e tabidir.
app.get("/api/diagnostic/whoami", (req, res) => {
    const origin = req.headers.origin || null;
    const referer = req.headers.referer || null;
    const ua = req.headers["user-agent"] || "";
    const xff = req.headers["x-forwarded-for"] || "";
    const realIp = req.headers["x-real-ip"] || "";
    const ip = (xff.toString().split(",")[0].trim()) || realIp || req.socket?.remoteAddress || "";

    const originAllowed = !origin || allowedOrigins.includes(origin) ||
                          (corsAllowAll) ||
                          (corsAllowLan && isPrivateLanOrigin(origin));

    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        message: "Sunucu sizi şöyle görüyor:",
        you: {
            origin,
            referer,
            ip,
            xForwardedFor: xff || null,
            xRealIp: realIp || null,
            remoteAddress: req.socket?.remoteAddress || null,
            userAgent: ua.slice(0, 200),
            isSecure: req.secure,
            protocol: req.protocol,
            host: req.headers.host,
        },
        cors: {
            yourOriginAllowed: originAllowed,
            allowedOriginsCount: allowedOrigins.length,
            allowedOrigins: process.env.NODE_ENV === "production" ? "[hidden]" : allowedOrigins,
            corsAllowAll,
            corsAllowLan,
        },
        server: {
            env: process.env.NODE_ENV || "development",
            uptimeSec: Math.floor((Date.now() - SERVER_START) / 1000),
            dbConnected: mongoose.connection.readyState === 1,
        },
    });
});

// POST /api/diagnostic/echo → request body ve headers'ı geri yansıtır.
// Login isteğinde 403 alıyorsanız aynı endpoint'e POST atın, ne gönderdiğinizi görün.
app.post("/api/diagnostic/echo", (req, res) => {
    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        message: "Echo OK — sunucu isteğinizi normal şekilde alıyor demektir.",
        received: {
            method: req.method,
            url: req.originalUrl,
            origin: req.headers.origin || null,
            contentType: req.headers["content-type"] || null,
            bodyKeys: Object.keys(req.body || {}),
            bodySize: JSON.stringify(req.body || {}).length,
        },
    });
});

// ─── 10. SUNUCU DURUM ENDPOINTİ (/api/status) ────────────────────────────────
// ✅ SEC: Public endpoint — sadece temel durum bilgisi döner
// Detaylı bilgiler (DB host, PID, memory, routes) sadece admin'e açık
app.get("/api/status", (req, res) => {
    const uptimeSec  = Math.floor((Date.now() - SERVER_START) / 1000);
    const uptimeMin  = Math.floor(uptimeSec / 60);
    const uptimeHour = Math.floor(uptimeMin / 60);
    const dbState    = ["disconnected", "connected", "connecting", "disconnecting"];

    // Public: sadece temel sağlık bilgisi
    const publicInfo = {
        status   : "online",
        uptime   : `${uptimeHour}s ${uptimeMin % 60}dk ${uptimeSec % 60}sn`,
        database : dbState[mongoose.connection.readyState] || "unknown",
        env      : process.env.NODE_ENV || "development",
    };

    // Admin kontrolü — token varsa detaylı bilgi ver
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (token) {
            const jwt = require("jsonwebtoken");
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded && ["admin", "dev"].includes(decoded.role)) {
                const memMB      = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
                const totalMemMB = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1);
                return res.json({
                    ...publicInfo,
                    memory   : { used: `${memMB} MB`, total: `${totalMemMB} MB` },
                    node     : process.version,
                    requests : {
                        total    : stats.total,
                        success  : stats.success,
                        clientErr: stats.clientErr,
                        serverErr: stats.serverErr,
                    },
                    topRoutes: Object.entries(stats.routes)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([route, count]) => ({ route, count })),
                });
            }
        }
    } catch { /* Token yoksa veya geçersizse public bilgi döner */ }

    res.json(publicInfo);
});

// ─── 11. 404 — Bilinmeyen route ───────────────────────────────────────────────
app.use((req, res, next) => {
    if (!req.path.startsWith("/api") && !req.path.includes(".")) {
        if (hasFrontendBuild) {
            return res.sendFile(buildIndexPath);
        }
        return res.status(503).type("html").send(
            "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem'>" +
            "<h1>Dashtock</h1><p>Frontend henuz yayinlanmamis.</p>" +
            "<p>Sunucuda: <code>powershell -File deploy-frontend.ps1</code> (yerel) calistirin.</p>" +
            "<p><code>git pull</code> tek basina yetmez — <code>frontend/build</code> gitte yoktur.</p>" +
            "</body></html>"
        );
    }
    next();
});

app.use((req, res) => {
    logger.warn(`404 Bulunamadı: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ success: false, message: "Endpoint bulunamadı." });
});

// ─── 12. Global hata yakalayıcı (Express) ────────────────────────────────────
// ✅ SEC: Production'da hata detayları gizlenir, CORS hataları özel mesaj döner
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    // CORS hatası özel mesaj
    if (err.message && err.message.includes("CORS")) {
        const origin = req.headers.origin || "?";
        const referer = req.headers.referer || "?";
        const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").toString().split(",")[0].trim();
        logger.warn(`🚫 CORS HATA → ${req.method} ${req.originalUrl} | origin="${origin}" | ip="${ip}" | ref="${referer.slice(0, 80)}"`);

        // ✅ AccessIncident'a logla — admin "kullanıcılar 403 alıyor neden?" sorusuna cevap bulsun
        // fire-and-forget; response'u bekletme
        try {
            const AccessIncident = require("./models/AccessIncident");
            const { extractClientInfo } = require("./utils/deviceInfo");
            const ci = extractClientInfo(req);
            AccessIncident.create({
                userId: null,
                email: req.body?.email || "",
                type: "suspicious_activity",
                severity: "warning",
                description: `CORS engellendi: ${origin} izinli origin listesinde yok. Backend .env'de CORS_EXTRA_ORIGINS'e ekleyin veya domain'i kullanın.`,
                ip: ci.ip,
                userAgent: ci.userAgent,
                device: ci.device,
                endpoint: req.originalUrl || req.url || "",
                method: req.method || "",
                statusCode: 403,
                metadata: { reason: "cors_blocked", origin, allowedOrigins: allowedOrigins.length },
            }).catch(() => {});
        } catch (_) { /* CORS check is best-effort */ }

        return res.status(403).json({
            success: false,
            code: "CORS_BLOCKED",
            message: process.env.NODE_ENV === "production"
                ? "Erişim engellendi (CORS). Lütfen doğru domain üzerinden bağlandığınızdan emin olun."
                : `CORS engellendi: ${origin} izinli origin listesinde yok. backend/.env'de CORS_EXTRA_ORIGINS'e ekleyin.`,
            origin,
        });
    }

    logger.error(`Global hata: ${err.message}`, { stack: err.stack, url: req.originalUrl });
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === "production"
            ? "Sunucu hatası oluştu."
            : err.message,
    });
});

// ─── 13. MongoDB bağlantısı & Sunucu başlatma ─────────────────────────────────
// ✅ FIX: Önce DB bağlantısı, sonra sunucu ve cron başlatılır
const connectDB = require("./config/db");

mongoose.connection.on("disconnected", () =>
    logger.warn(
        "MongoDB bağlantısı geçici olarak kesildi — sürücü çoğu durumda otomatik yeniden bağlanır; " +
            "birkaç saniye içinde 'MongoDB yeniden bağlandı' görünmeli. Görünmüyorsa Atlas IP listesi / ağ / VPN kontrol edin. " +
            "IPv4 sorununda: MONGODB_FORCE_IPV4=true deneyin."
    )
);
mongoose.connection.on("reconnected", () =>
    logger.info("MongoDB yeniden bağlandı ✅")
);
mongoose.connection.on("connected", () => {
    if (mongoose.connection.readyState === 1) {
        logger.debug(`MongoDB topology hazır — host: ${mongoose.connection.host || "-"}`);
    }
});
mongoose.connection.on("error", (err) =>
    logger.error(`MongoDB bağlantı hatası: ${err?.message || err}`)
);

let server; // global referans — graceful shutdown için

const startServer = async () => {
    // ─── 13a. Önce MongoDB bağlantısını kur ────────────────────────────────────
    await connectDB();

    // Route'lar model yüklerken DB kapalıyken index() tetiklenmesin diye: bağlantı sonrası tek seferlik temizlik
    try {
        const AutoOrderConfig = require("./models/AutoOrderConfig");
        if (typeof AutoOrderConfig.cleanupLegacyAutoOrderIndexes === "function") {
            await AutoOrderConfig.cleanupLegacyAutoOrderIndexes();
        }
    } catch (e) {
        logger.warn(`AutoOrderConfig index temizliği atlandı: ${e.message}`);
    }

    // ─── 14. Sunucuyu başlat (DB bağlantısı başarılı olduktan sonra) ───────────
    const PORT = process.env.PORT || 5000;
    server = app.listen(PORT, '0.0.0.0', () => {
        const line = "─".repeat(52);
        logger.info(`\n${line}`);
        logger.info(`  🚀  Dashtock Backend başlatıldı`);
        logger.info(`  📡  Port     : ${PORT}`);
        logger.info(`  🌍  Ortam    : ${process.env.NODE_ENV || "development"}`);
        logger.info(`  🔗  Site     : ${APP_URL}`);
        logger.info(`  📊  Durum    : http://localhost:${PORT}/api/status`);
        logger.info(`  🕐  Başlangıç: ${new Date().toLocaleString("tr-TR")}`);
        try {
            const paytrService = require("./services/paytrService");
            const paytr = paytrService.getConfigStatus();
            if (paytr.configured) {
                logger.info(`  💳  PayTR   : hazır (test_mode=${paytr.testMode}, bildirim=${paytr.notifyUrl})`);
            } else {
                logger.warn(`  💳  PayTR   : EKSIK — backend/.env → PAYTR_MERCHANT_ID/KEY/SALT + pm2 restart`);
            }
        } catch (e) {
            logger.warn(`  💳  PayTR   : durum okunamadı (${e.message})`);
        }
        logger.info(`${line}\n`);

        const disableBackgroundJobs =
            process.env.DISABLE_BACKGROUND_JOBS === "true" ||
            process.env.DISABLE_BACKGROUND_JOBS === "1";

        if (disableBackgroundJobs) {
            logger.warn(
                "⏸ Arka plan işleri kapalı (DISABLE_BACKGROUND_JOBS). Stok/AI/Radar cron'ları çalışmıyor."
            );
        } else {
            // ─── Otomatik Stok Senkronizasyon Cron'unu Başlat ─────────────────────
            try {
                const { startStockCron } = require("./services/stockCronService");
                startStockCron();
                logger.info("Stok senkronizasyon cron'u başlatıldı ✅");

                const { startBackgroundIdentityRepair } = require("./services/productIdentityGuardService");
                startBackgroundIdentityRepair();
                logger.info("Ürün kimlik koruyucu (tüm kullanıcılar) arka planda başlatıldı ✅");
            } catch (err) {
                logger.warn(`Stok cron başlatılamadı: ${err.message}`);
            }

            // ─── Otomatik Faturalama Cron'unu Başlat ────────────────────────────
            try {
                const { startInvoiceCron } = require("./services/invoiceCronService");
                startInvoiceCron();
                logger.info("🧾 Otomatik faturalama cron'u başlatıldı ✅");
            } catch (err) {
                logger.warn(`Fatura cron başlatılamadı: ${err.message}`);
            }

            // ─── Otomatik Sipariş İşleme Cron'unu Başlat ─────────────────────
            try {
                const { startAutoOrderCron } = require("./services/autoOrderCronService");
                startAutoOrderCron();
                logger.info("📦 Otomatik sipariş işleme cron'u başlatıldı ✅");
            } catch (err) {
                logger.warn(`Sipariş işleme cron başlatılamadı: ${err.message}`);
            }

            // ─── Pazaryeri sipariş ingestion (DB + e-posta bildirimi) ─────────
            try {
                const { startOrderSyncCron } = require("./services/orderSyncCronService");
                startOrderSyncCron();
                logger.info("📥 Pazaryeri sipariş sync cron'u başlatıldı ✅");
            } catch (err) {
                logger.warn(`Sipariş sync cron başlatılamadı: ${err.message}`);
            }

            // ─── AI Background Worker — Tüm kullanıcıları arka planda analiz eder ──
            try {
                const { startAIWorker } = require("./services/aiBackgroundWorker");
                startAIWorker();
                logger.info("🧠 AI Background Worker başlatıldı ✅");
            } catch (err) {
                logger.warn(`AI Worker başlatılamadı: ${err.message}`);
            }

            // ─── LysiaRadar PRO Worker — Fırsat tarama motoru ──
            try {
                const { startRadarWorker } = require("./services/radar/radarWorker");
                startRadarWorker();
                logger.info("🔭 LysiaRadar PRO Worker başlatıldı ✅");
            } catch (err) {
                logger.warn(`Radar Worker başlatılamadı: ${err.message}`);
            }

            // ─── Pazarlama — planlı kampanyalar ve otomasyon kuyruğu ──
            try {
                const { startMarketingScheduler } = require("./services/marketing/marketingSchedulerService");
                const { startMarketingQueueWorker } = require("./services/marketing/marketingQueueService");
                startMarketingScheduler();
                startMarketingQueueWorker();
                logger.info("📣 Pazarlama zamanlayıcı ve kuyruk başlatıldı ✅");
            } catch (err) {
                logger.warn(`Pazarlama worker başlatılamadı: ${err.message}`);
            }

            // ─── Website Builder — domain DNS doğrulama (periyodik) ──
            if (process.env.WB_DOMAIN_WORKER_ENABLED !== "false") {
                try {
                    const { startWbDomainWorker } = require("./workers/wbDomainWorker");
                    startWbDomainWorker();
                    logger.info("🌐 Website Builder Domain Worker başlatıldı ✅");
                } catch (err) {
                    logger.warn(`Website Builder domain worker başlatılamadı: ${err.message}`);
                }
            }

            // ─── Website Builder — SSL provisioning (Caddy on-demand TLS) ──
            if (process.env.WB_SSL_WORKER_ENABLED !== "false") {
                try {
                    const { startWbSslWorker } = require("./workers/wbSslWorker");
                    startWbSslWorker();
                    logger.info("🔒 Website Builder SSL Worker başlatıldı ✅");
                } catch (err) {
                    logger.warn(`Website Builder SSL worker başlatılamadı: ${err.message}`);
                }
            }

            // ─── Website Builder AI — BullMQ worker (wb-ai-* kuyrukları, REDIS_URL zorunlu) ──
            if (process.env.WB_AI_WORKER_ENABLED !== "false" && process.env.REDIS_URL) {
                try {
                    const { startWorkers: startWbAIWorkers } = require("./workers/wbAIWorker");
                    startWbAIWorkers().catch((err) => {
                        logger.warn(`Website Builder AI worker başlatılamadı: ${err.message}`);
                    });
                    logger.info("✨ Website Builder AI Worker başlatıldı ✅");
                } catch (err) {
                    logger.warn(`Website Builder AI worker yüklenemedi: ${err.message}`);
                }
            }

            // ─── Startup Cleanup: Eski öneriler + AI cache invalidate ──
            try {
                const Recommendation = require("./models/Recommendation");
                const AIAnalysisCache = require("./models/AIAnalysisCache");

                Recommendation.deleteMany({
                    $or: [
                        { "actionPayload.actionType": "mark_inactive" },
                        { description: { $regex: /[Pp]asife al/i } },
                        { title: { $regex: /Ölü Ürün/i } },
                    ],
                })
                    .then((cleaned) => {
                        if (cleaned.deletedCount > 0) {
                            logger.info(`🧹 Startup cleanup: ${cleaned.deletedCount} eski öneri silindi ✅`);
                        }
                    })
                    .catch((e) => logger.warn(`Startup cleanup (recommendations): ${e.message}`));

                AIAnalysisCache.updateMany({}, { $set: { lastAnalyzedAt: new Date(0) } })
                    .then((r) => {
                        if (r.modifiedCount > 0) {
                            logger.info(`🧹 Startup cleanup: ${r.modifiedCount} AI cache invalidate ✅`);
                        }
                    })
                    .catch((e) => logger.warn(`Startup cleanup (cache): ${e.message}`));
            } catch (err) {
                logger.warn(`Startup cleanup başarısız: ${err.message}`);
            }
        }
    });
};

startServer();

// ─── 15. İşlem seviyesi hata yakalama ────────────────────────────────────────
process.on("unhandledRejection", (reason, promise) => {
    logger.error(`Yakalanmamış Promise Reddi: ${reason}`, { promise });
});

process.on("uncaughtException", (err) => {
    logger.error(`Yakalanmamış İstisna: ${err.message}`, { stack: err.stack });
    // Kritik hatalarda sunucuyu düzgün kapat
    if (server) server.close(() => process.exit(1));
    else process.exit(1);
});

// Ctrl+C veya SIGTERM → direkt çık
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
