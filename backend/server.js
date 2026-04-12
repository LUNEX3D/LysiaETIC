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

// ─── 1. ENV — EN ÜSTTE yüklenmeli ────────────────────────────────────────────
require("dotenv").config();

const express        = require("express");
const mongoose       = require("mongoose");
const cors           = require("cors");
const helmet         = require("helmet");
const hpp            = require("hpp");
const mongoSanitize  = require("express-mongo-sanitize");
const dns            = require("dns");
const os             = require("os");
const logger         = require("./config/logger");
const { apiLimiter }        = require("./middlewares/rateLimiter");
const { sanitizeBody }      = require("./middlewares/sanitize");
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
const aiEngineRoutes          = require("./routes/aiEngineRoutes");
const aiChatRoutes            = require("./routes/aiChatRoutes");

const roketfyRoutes           = require("./routes/roketfyRoutes");
const notificationRoutes      = require("./routes/notificationRoutes");
const autoInvoiceRoutes       = require("./routes/autoInvoiceRoutes");
const categoryCenterRoutes    = require("./routes/categoryCenterRoutes");
const radarRoutes             = require("./routes/radarRoutes");
// ✅ FIX #3: Webhook route'ları — pazaryeri anlık bildirim endpoint'leri
const webhookRoutes           = require("./routes/webhookRoutes");

// ─── 3. DNS & App ─────────────────────────────────────────────────────────────
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const app = express();

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

// ─── 6. GÜVENLİK — Helmet.js ─────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false  // Frontend SPA ile uyumluluk
}));

// ─── 7. CORS — Whitelist bazlı ───────────────────────────────────────────────
const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5000",
    // Production — hem HTTP hem HTTPS (SSL sertifikası eklenene kadar HTTP de gerekli)
    "http://13.51.158.124",
    "http://13.51.158.124:3000",
    "http://13.51.158.124:5000",
    "https://13.51.158.124",
    "https://13.51.158.124:3000",
    "https://lunexetic.com",
    "https://www.lunexetic.com",
    "http://lunexetic.com",
    "http://www.lunexetic.com"
];

app.use(cors({
    origin: function (origin, callback) {
        // Server-to-server istekler (origin yok) veya whitelist'teki origin'ler
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn(`CORS engellendi: ${origin}`);
            callback(new Error("CORS policy: Bu origin'e izin verilmiyor."));
        }
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

// ─── 8.1 Genel API Rate Limiter ──────────────────────────────────────────────
// ✅ PayTR callback ve Webhook endpoint'lerini rate limiter'dan muaf tut
// PayTR sunucusu ve pazaryeri webhook sunucuları doğrudan erişmeli
app.use("/api/", (req, res, next) => {
    if (req.originalUrl === "/api/paytr/callback" && req.method === "POST") {
        return next(); // Rate limiter atla
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
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "LysiaETIC API Docs",
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

// ─── 9. Route'ları bağla ──────────────────────────────────────────────────────
app.use("/api/orders",             orderRoutes);
app.use("/api/products",           productRoutes);
app.use("/api/auth",               authRoutes);
app.use("/api/marketplace",        marketplaceRoutes);
app.use("/api/ai",                 aiRoutes);
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
app.use("/api/ai-engine",       aiEngineRoutes);
app.use("/api/ai-chat",        aiChatRoutes);
app.use("/api/roketfy",        roketfyRoutes);
app.use("/api/notifications",  notificationRoutes);
app.use("/api/auto-invoice",   autoInvoiceRoutes);
app.use("/api/category-center", categoryCenterRoutes);
app.use("/api/radar",          radarRoutes);
// ✅ FIX #3: Webhook endpoint'leri — auth gerektirmez, pazaryerlerinden gelir
app.use("/api/webhooks",       webhookRoutes);

// ✅ FIX #9: Eksik route bağlantıları — dosyalar var ama server.js'de bağlı değildi
const inventoryRoutes         = require("./routes/inventoryRoutes");
const brandRoutes             = require("./routes/brandRoutes");
const variantRoutes           = require("./routes/variantRoutes");
const uploadRoutes            = require("./routes/uploadRoutes");
app.use("/api/inventory",      inventoryRoutes);
app.use("/api/brands",         brandRoutes);
app.use("/api/variants",       variantRoutes);
app.use("/api/upload",         uploadRoutes);

// ─── 10. SUNUCU DURUM ENDPOINTİ (/api/status) ────────────────────────────────
app.get("/api/status", (req, res) => {
    const uptimeSec  = Math.floor((Date.now() - SERVER_START) / 1000);
    const uptimeMin  = Math.floor(uptimeSec / 60);
    const uptimeHour = Math.floor(uptimeMin / 60);
    const memMB      = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const totalMemMB = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1);
    const dbState    = ["Bağlantı Yok", "Bağlı ✅", "Bağlanıyor...", "Bağlantı Kesiliyor..."];

    res.json({
        status   : "online",
        uptime   : `${uptimeHour}s ${uptimeMin % 60}dk ${uptimeSec % 60}sn`,
        database : {
            state  : dbState[mongoose.connection.readyState] || "Bilinmiyor",
            host   : mongoose.connection.host   || "-",
            name   : mongoose.connection.name   || "-",
        },
        memory   : { used: `${memMB} MB`, total: `${totalMemMB} MB` },
        node     : process.version,
        platform : process.platform,
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
        env      : process.env.NODE_ENV || "development",
        pid      : process.pid,
    });
});

// ─── 11. 404 — Bilinmeyen route ───────────────────────────────────────────────
app.use((req, res) => {
    logger.warn(`404 Bulunamadı: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ success: false, message: "Endpoint bulunamadı." });
});

// ─── 12. Global hata yakalayıcı (Express) ────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
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
    logger.warn("MongoDB bağlantısı kesildi!")
);
mongoose.connection.on("reconnected", () =>
    logger.info("MongoDB yeniden bağlandı ✅")
);

let server; // global referans — graceful shutdown için

const startServer = async () => {
    // ─── 13a. Önce MongoDB bağlantısını kur ────────────────────────────────────
    await connectDB();

    // ─── 14. Sunucuyu başlat (DB bağlantısı başarılı olduktan sonra) ───────────
    const PORT = process.env.PORT || 5000;
    server = app.listen(PORT, '0.0.0.0', () => {
        const line = "─".repeat(52);
        logger.info(`\n${line}`);
        logger.info(`  🚀  LysiaETIC Backend başlatıldı`);
        logger.info(`  📡  Port     : ${PORT}`);
        logger.info(`  🌍  Ortam    : ${process.env.NODE_ENV || "development"}`);
        logger.info(`  📊  Durum    : http://localhost:${PORT}/api/status`);
        logger.info(`  🕐  Başlangıç: ${new Date().toLocaleString("tr-TR")}`);
        logger.info(`${line}\n`);

        // ─── Otomatik Stok Senkronizasyon Cron'unu Başlat ─────────────────────
        try {
            const { startStockCron } = require("./services/stockCronService");
            startStockCron();
            logger.info("Stok senkronizasyon cron'u başlatıldı ✅");
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

        // ─── Startup Cleanup: Eski "pasife al" / "Ölü Ürün" önerilerini sil + cache invalidate ──
        try {
            const Recommendation = require("./models/Recommendation");
            const AIAnalysisCache = require("./models/AIAnalysisCache");

            // 1. DB'den eski önerileri sil
            Recommendation.deleteMany({ $or: [
                { "actionPayload.actionType": "mark_inactive" },
                { description: { $regex: /[Pp]asife al/i } },
                { title: { $regex: /Ölü Ürün/i } },
            ]}).then(cleaned => {
                if (cleaned.deletedCount > 0) {
                    logger.info(`🧹 Startup cleanup: ${cleaned.deletedCount} eski "pasife al/Ölü Ürün" önerisi silindi ✅`);
                }
            }).catch(e => logger.warn(`Startup cleanup (recommendations) başarısız: ${e.message}`));

            // 2. Tüm AI cache'leri invalidate et — worker taze veri üretsin
            AIAnalysisCache.updateMany({}, { $set: { lastAnalyzedAt: new Date(0) } })
                .then(r => {
                    if (r.modifiedCount > 0) {
                        logger.info(`🧹 Startup cleanup: ${r.modifiedCount} AI cache invalidate edildi ✅`);
                    }
                }).catch(e => logger.warn(`Startup cleanup (cache) başarısız: ${e.message}`));
        } catch (err) {
            logger.warn(`Startup cleanup başarısız: ${err.message}`);
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
