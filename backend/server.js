/**
 * server.js — LysiaETIC Backend
 *
 * ✅ dotenv en üstte yükleniyor
 * ✅ Terminal'de renkli HTTP istek / hata izleme
 * ✅ Sunucu durumu (uptime, bellek, DB) için /api/status endpoint'i
 * ✅ Global hata yakalama (unhandledRejection / uncaughtException)
 * ✅ Genel yapı korundu — sadece izleme & güvenlik katmanları eklendi
 */

// ─── 1. ENV — EN ÜSTTE yüklenmeli ────────────────────────────────────────────
require("dotenv").config();

const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");
const dns      = require("dns");
const os       = require("os");
const logger   = require("./config/logger");

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

// ─── 6. CORS ──────────────────────────────────────────────────────────────────
// Token-based auth (localStorage + Authorization header) kullanıldığı için
// credentials gerekmez. Tüm origin'lere izin veriyoruz.
app.use(cors());

// ─── 7. Body parser ───────────────────────────────────────────────────────────
app.use(express.json());

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

// ─── 13. MongoDB bağlantısı ───────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
    .then(() => logger.info("MongoDB bağlantısı başarılı ✅"))
    .catch((err) => logger.error(`MongoDB bağlantı hatası: ${err.message}`));

mongoose.connection.on("disconnected", () =>
    logger.warn("MongoDB bağlantısı kesildi!")
);
mongoose.connection.on("reconnected", () =>
    logger.info("MongoDB yeniden bağlandı ✅")
);

// ─── 14. Sunucuyu başlat ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
    const line = "─".repeat(52);
    logger.info(`\n${line}`);
    logger.info(`  🚀  LysiaETIC Backend başlatıldı`);
    logger.info(`  📡  Port     : ${PORT}`);
    logger.info(`  🌍  Ortam    : ${process.env.NODE_ENV || "development"}`);
    logger.info(`  📊  Durum    : http://localhost:${PORT}/api/status`);
    logger.info(`  🕐  Başlangıç: ${new Date().toLocaleString("tr-TR")}`);
    logger.info(`${line}\n`);

    // ─── Otomatik Stok Senkronizasyon Cron'unu Başlat ────────────────────────
    const { startStockCron } = require("./services/stockCronService");
    startStockCron();
});

// ─── 15. İşlem seviyesi hata yakalama ────────────────────────────────────────
process.on("unhandledRejection", (reason, promise) => {
    logger.error(`Yakalanmamış Promise Reddi: ${reason}`, { promise });
});

process.on("uncaughtException", (err) => {
    logger.error(`Yakalanmamış İstisna: ${err.message}`, { stack: err.stack });
    // Kritik hatalarda sunucuyu düzgün kapat
    server.close(() => process.exit(1));
});

process.on("SIGTERM", () => {
    logger.info("SIGTERM alındı — sunucu kapatılıyor...");
    const { stopStockCron } = require("./services/stockCronService");
    stopStockCron();
    server.close(() => {
        mongoose.connection.close(false, () => {
            logger.info("Sunucu ve DB bağlantısı kapatıldı.");
            process.exit(0);
        });
    });
});
