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
 */

// ─── 1. ENV — EN ÜSTTE yüklenmeli ────────────────────────────────────────────
require("dotenv").config();

const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");
const helmet   = require("helmet");
const dns      = require("dns");
const os       = require("os");
const logger   = require("./config/logger");
const { apiLimiter }  = require("./middlewares/rateLimiter");

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
const categorySmartRoutes     = require("./routes/categorySmartRoutes");

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
    "http://13.51.158.124",
    "http://13.51.158.124:3000",
    "https://lunexetic.com",
    "https://www.lunexetic.com"
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

// ─── 8.1 Genel API Rate Limiter ──────────────────────────────────────────────
// ✅ PayTR callback endpoint'ini rate limiter'dan muaf tut (PayTR sunucusu erişmeli)
app.use("/api/", (req, res, next) => {
    if (req.originalUrl === "/api/paytr/callback" && req.method === "POST") {
        return next(); // Rate limiter atla
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

// ─── 9. Route'ları bağla ──────────────────────────────────────────────────────
app.use("/api/orders",             orderRoutes);
app.use("/api/products",           productRoutes);
app.use("/api/auth",               authRoutes);
app.use("/api/marketplace",        marketplaceRoutes);
app.use("/api/ai",                 aiRoutes);
app.use("/api/categories",         categoryRoutes);
app.use("/hepsiburada",            hepsiburadaRoutes);
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
app.use("/api/category-smart", categorySmartRoutes);

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

process.on("SIGTERM", () => {
    logger.info("SIGTERM alındı — sunucu kapatılıyor...");
    const { stopStockCron } = require("./services/stockCronService");
    stopStockCron();
    if (server) {
        server.close(() => {
            mongoose.connection.close(false, () => {
                logger.info("Sunucu ve DB bağlantısı kapatıldı.");
                process.exit(0);
            });
        });
    } else {
        process.exit(0);
    }
});
