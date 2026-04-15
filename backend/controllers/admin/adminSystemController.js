const os = require("os");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const User = require("../../models/User");
const AuditLog = require("../../models/AuditLog");
const logger = require("../../config/logger");

// ── Yardımcılar ──────────────────────────────────────────────────────────────

/** Byte → okunabilir birim */
const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
};

/** Saniye → okunabilir süre */
const formatDuration = (totalSec) => {
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.floor(totalSec % 60);
    return { days: d, hours: h, minutes: m, seconds: s, formatted: `${d}g ${h}s ${m}dk ${s}sn` };
};

/** İki ölçüm arası gerçek CPU kullanımı (500ms sample) */
const measureCpuUsage = () => new Promise((resolve) => {
    const startCpus = os.cpus();
    setTimeout(() => {
        const endCpus = os.cpus();
        let totalUsage = 0;
        for (let i = 0; i < endCpus.length; i++) {
            const startTotal = Object.values(startCpus[i].times).reduce((a, b) => a + b, 0);
            const endTotal = Object.values(endCpus[i].times).reduce((a, b) => a + b, 0);
            const startIdle = startCpus[i].times.idle;
            const endIdle = endCpus[i].times.idle;
            const totalDiff = endTotal - startTotal;
            const idleDiff = endIdle - startIdle;
            totalUsage += totalDiff > 0 ? ((totalDiff - idleDiff) / totalDiff) * 100 : 0;
        }
        resolve(Math.round((totalUsage / endCpus.length) * 100) / 100);
    }, 500);
});

/** AuditLog'a kayıt yaz */
const writeAuditLog = async (req, action, category, description, metadata = {}, severity = "info", success = true) => {
    try {
        await AuditLog.create({
            userId: metadata.targetUserId || undefined,
            adminId: req.user?._id || req.user?.id,
            action,
            category,
            severity,
            description,
            metadata,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.headers?.["user-agent"] || "",
            success,
        });
    } catch (e) {
        logger.warn(`[AuditLog] Yazma hatası: ${e.message}`);
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/admin/system/status — Sunucu durumu ve sistem metrikleri
// ═════════════════════════════════════════════════════════════════════════════
exports.getSystemStatus = async (req, res) => {
    try {
        const uptimeSec = Math.floor(process.uptime());
        const memUsage = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        const cpus = os.cpus();
        const cpuModel = cpus[0]?.model || "Bilinmiyor";
        const cpuCount = cpus.length;

        // ── Gerçek CPU kullanımı (iki ölçüm arası delta) ──
        const cpuUsage = await measureCpuUsage();

        // ── DB durumu ──
        const dbStates = ["Bağlantı Yok", "Bağlı", "Bağlanıyor", "Bağlantı Kesiliyor"];
        const dbState = mongoose.connection.readyState;

        // ── DB istatistikleri (koleksiyon sayısı, veri boyutu) ──
        let dbStats = null;
        if (dbState === 1) {
            try {
                const adminDb = mongoose.connection.db.admin();
                const serverStatus = await adminDb.serverStatus();
                const dbInfo = await mongoose.connection.db.stats();
                dbStats = {
                    collections: dbInfo.collections || 0,
                    documents: dbInfo.objects || 0,
                    dataSize: formatBytes(dbInfo.dataSize || 0),
                    storageSize: formatBytes(dbInfo.storageSize || 0),
                    indexSize: formatBytes(dbInfo.indexSize || 0),
                    connections: {
                        current: serverStatus.connections?.current || 0,
                        available: serverStatus.connections?.available || 0,
                    },
                    opcounters: {
                        insert: serverStatus.opcounters?.insert || 0,
                        query: serverStatus.opcounters?.query || 0,
                        update: serverStatus.opcounters?.update || 0,
                        delete: serverStatus.opcounters?.delete || 0,
                    },
                };
            } catch (dbErr) {
                logger.debug(`[AdminSystem] DB stats alınamadı: ${dbErr.message}`);
            }
        }

        // ── Kullanıcı istatistikleri (paralel sorgular) ──
        const now = Date.now();
        const [totalUsers, adminUsers, activeToday, activeThisWeek, newThisMonth] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: "admin" }),
            User.countDocuments({ updatedAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } }),
            User.countDocuments({ updatedAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } }),
            User.countDocuments({ createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } }),
        ]);

        // ── Abonelik dağılımı ──
        let subscriptionStats = {};
        try {
            const subAgg = await User.aggregate([
                { $group: { _id: "$subscription.plan", count: { $sum: 1 } } },
            ]);
            for (const s of subAgg) {
                subscriptionStats[s._id || "unknown"] = s.count;
            }
        } catch { /* ignore */ }

        // ── Worker durumları ──
        let workers = {};
        try {
            const { getRadarWorkerStatus } = require("../../services/radar/radarWorker");
            workers.radar = getRadarWorkerStatus();
        } catch { workers.radar = { isActive: false, error: "Modül yüklenemedi" }; }

        try {
            const aiWorker = require("../../services/aiBackgroundWorker");
            workers.ai = aiWorker.getWorkerStatus();
        } catch { workers.ai = { isActive: false, error: "Modül yüklenemedi" }; }

        // ── Disk kullanımı (logs dizini) ──
        let diskInfo = null;
        try {
            const logDir = path.join(__dirname, "../../logs");
            if (fs.existsSync(logDir)) {
                const logFiles = fs.readdirSync(logDir);
                let totalLogSize = 0;
                for (const f of logFiles) {
                    try {
                        const stat = fs.statSync(path.join(logDir, f));
                        totalLogSize += stat.size;
                    } catch { /* skip */ }
                }
                diskInfo = {
                    logFiles: logFiles.length,
                    logDirSize: formatBytes(totalLogSize),
                    logDirSizeBytes: totalLogSize,
                };
            }
        } catch { /* ignore */ }

        // ── Event Loop Lag (performans göstergesi) ──
        const eventLoopLag = await new Promise((resolve) => {
            const start = process.hrtime.bigint();
            setImmediate(() => {
                const delta = Number(process.hrtime.bigint() - start) / 1e6; // ms
                resolve(Math.round(delta * 100) / 100);
            });
        });

        res.json({
            success: true,
            server: {
                status: "online",
                uptime: formatDuration(uptimeSec),
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version,
                pid: process.pid,
                env: process.env.NODE_ENV || "development",
                eventLoopLagMs: eventLoopLag,
            },
            cpu: {
                model: cpuModel,
                cores: cpuCount,
                usage: cpuUsage,
                loadAvg: os.loadavg().map(l => Math.round(l * 100) / 100),
            },
            memory: {
                system: {
                    total: formatBytes(totalMem),
                    used: formatBytes(usedMem),
                    free: formatBytes(freeMem),
                    totalBytes: totalMem,
                    usedBytes: usedMem,
                    usagePercent: Math.round((usedMem / totalMem) * 100),
                },
                process: {
                    heapUsed: formatBytes(memUsage.heapUsed),
                    heapTotal: formatBytes(memUsage.heapTotal),
                    rss: formatBytes(memUsage.rss),
                    external: formatBytes(memUsage.external),
                    heapUsedBytes: memUsage.heapUsed,
                    heapTotalBytes: memUsage.heapTotal,
                    rssBytes: memUsage.rss,
                    heapUsagePercent: memUsage.heapTotal > 0
                        ? Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
                        : 0,
                },
            },
            database: {
                state: dbStates[dbState] || "Bilinmiyor",
                stateCode: dbState,
                host: mongoose.connection.host || "-",
                name: mongoose.connection.name || "-",
                connected: dbState === 1,
                stats: dbStats,
            },
            users: {
                total: totalUsers,
                admins: adminUsers,
                activeToday,
                activeThisWeek,
                newThisMonth,
                subscriptions: subscriptionStats,
            },
            workers,
            disk: diskInfo,
            os: {
                type: os.type(),
                release: os.release(),
                networkInterfaces: Object.entries(os.networkInterfaces()).reduce((acc, [name, interfaces]) => {
                    const ipv4 = interfaces.find(i => i.family === "IPv4" && !i.internal);
                    if (ipv4) acc[name] = ipv4.address;
                    return acc;
                }, {}),
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error(`Sistem durumu hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Sistem durumu alınamadı" });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/admin/system/servers — Sunucu listesi + gerçek health check
// ═════════════════════════════════════════════════════════════════════════════
exports.getServers = async (req, res) => {
    try {
        const http = require("http");

        /** Basit HTTP health check — timeout ile */
        const checkHealth = (url, timeoutMs = 5000) => new Promise((resolve) => {
            try {
                const parsedUrl = new URL(url);
                const startTime = Date.now();
                const request = http.get({
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port || 80,
                    path: parsedUrl.pathname,
                    timeout: timeoutMs,
                }, (response) => {
                    const latency = Date.now() - startTime;
                    resolve({
                        status: response.statusCode >= 200 && response.statusCode < 500 ? "online" : "degraded",
                        statusCode: response.statusCode,
                        latencyMs: latency,
                    });
                    response.resume(); // consume response
                });
                request.on("error", () => resolve({ status: "offline", statusCode: 0, latencyMs: 0 }));
                request.on("timeout", () => {
                    request.destroy();
                    resolve({ status: "timeout", statusCode: 0, latencyMs: timeoutMs });
                });
            } catch {
                resolve({ status: "offline", statusCode: 0, latencyMs: 0 });
            }
        });

        // ── Sunucu tanımları ──
        const backendPort = process.env.PORT || 5000;
        const backendUrl = `http://127.0.0.1:${backendPort}`;

        const serverDefs = [
            {
                id: "backend-api",
                name: "LysiaETIC Backend API",
                type: "api",
                url: `http://${req.headers.host || `localhost:${backendPort}`}`,
                internalUrl: `${backendUrl}`,
                port: backendPort,
                healthCheckPath: "/api/status",
                description: "Ana API sunucusu — Express.js",
                version: process.env.npm_package_version || "1.0.0",
            },
            {
                id: "frontend-nginx",
                name: "LysiaETIC Frontend",
                type: "web",
                url: `http://${(req.headers.host || "localhost").split(":")[0]}`,
                internalUrl: "http://127.0.0.1:80",
                port: 80,
                healthCheckPath: "/",
                description: "React SPA — Nginx ile serve ediliyor",
                version: "1.0.0",
            },
            {
                id: "mongodb-atlas",
                name: "MongoDB Atlas",
                type: "database",
                url: mongoose.connection.host ? `mongodb+srv://${mongoose.connection.host}` : "-",
                internalUrl: null,
                port: null,
                healthCheckPath: null,
                description: `Veritabanı: ${mongoose.connection.name || "-"}`,
                version: "Atlas",
            },
        ];

        // ── Paralel health check ──
        const servers = await Promise.all(serverDefs.map(async (srv) => {
            let health = { status: "unknown", statusCode: 0, latencyMs: 0 };

            if (srv.id === "mongodb-atlas") {
                // DB için mongoose state kullan
                const dbReady = mongoose.connection.readyState === 1;
                health = {
                    status: dbReady ? "online" : "offline",
                    statusCode: dbReady ? 200 : 0,
                    latencyMs: 0,
                };
                // DB ping
                if (dbReady) {
                    try {
                        const pingStart = Date.now();
                        await mongoose.connection.db.admin().ping();
                        health.latencyMs = Date.now() - pingStart;
                    } catch { /* ignore */ }
                }
            } else if (srv.internalUrl && srv.healthCheckPath) {
                health = await checkHealth(`${srv.internalUrl}${srv.healthCheckPath}`);
            }

            return {
                ...srv,
                status: health.status,
                statusCode: health.statusCode,
                latencyMs: health.latencyMs,
                uptime: srv.id === "backend-api" ? Math.floor(process.uptime()) : undefined,
                memory: srv.id === "backend-api"
                    ? formatBytes(process.memoryUsage().heapUsed)
                    : undefined,
                lastCheck: new Date().toISOString(),
            };
        }));

        res.json({ success: true, servers });
    } catch (error) {
        logger.error(`Sunucu listesi hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Sunucu listesi alınamadı" });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/system/impersonate/:userId — Kullanıcı paneline erişim
// ═════════════════════════════════════════════════════════════════════════════
exports.impersonateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const adminUser = req.user;

        // ── Yetki kontrolü ──
        if (adminUser.role !== "admin" && adminUser.role !== "dev") {
            await writeAuditLog(req, "impersonate_denied", "security",
                `Yetkisiz impersonate denemesi: ${adminUser.email}`,
                { targetUserId: userId }, "warning", false);
            return res.status(403).json({ success: false, message: "Bu işlem için admin yetkisi gerekli" });
        }

        // ── Admin kendini hedef alamaz ──
        const adminId = String(adminUser._id || adminUser.id);
        if (adminId === String(userId)) {
            return res.status(400).json({ success: false, message: "Kendi hesabınıza impersonate yapamazsınız" });
        }

        const targetUser = await User.findById(userId).select("-password -refreshTokens -security.twoFactorSecret");
        if (!targetUser) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
        }

        // ── Başka bir admin'e impersonate engeli (dev hariç) ──
        if (targetUser.role === "admin" && adminUser.role !== "dev") {
            await writeAuditLog(req, "impersonate_denied", "security",
                `Admin→Admin impersonate engellendi: ${adminUser.email} → ${targetUser.email}`,
                { targetUserId: userId }, "warning", false);
            return res.status(403).json({ success: false, message: "Başka bir admin hesabına erişim sağlayamazsınız" });
        }

        // ── JWT token oluştur ──
        const jwt = require("jsonwebtoken");
        const impersonateToken = jwt.sign(
            {
                id: targetUser._id,
                role: targetUser.role,
                impersonatedBy: adminId,
                isImpersonation: true,
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        // ── Audit log ──
        await writeAuditLog(req, "impersonate_user", "security",
            `Admin ${adminUser.email} → kullanıcı ${targetUser.email} paneline erişim sağladı`,
            {
                targetUserId: targetUser._id,
                targetEmail: targetUser.email,
                targetRole: targetUser.role,
                tokenExpiresIn: "1h",
            },
            "warning", true);

        logger.info(`[Impersonate] Admin ${adminUser.email} → ${targetUser.email}`);

        res.json({
            success: true,
            message: `${targetUser.name} kullanıcısının paneline erişim sağlandı`,
            token: impersonateToken,
            user: {
                _id: targetUser._id,
                name: targetUser.name,
                email: targetUser.email,
                role: targetUser.role,
                subscription: targetUser.subscription?.plan || "free",
            },
            expiresIn: "1 saat",
        });
    } catch (error) {
        logger.error(`Impersonate hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Kullanıcı erişimi sağlanamadı" });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/admin/system/logs — Sistem logları (filtreleme + sayfalama)
// ═════════════════════════════════════════════════════════════════════════════
exports.getSystemLogs = async (req, res) => {
    try {
        const {
            file: targetFile,       // Belirli bir log dosyası
            level,                  // "error", "warn", "info", "http", "debug"
            search,                 // Mesaj içinde arama
            limit: rawLimit = 100,  // Satır limiti
            offset: rawOffset = 0,  // Başlangıç satırı
        } = req.query;

        const limit = Math.min(parseInt(rawLimit) || 100, 500);  // Max 500 satır
        const offset = parseInt(rawOffset) || 0;
        const logDir = path.join(__dirname, "../../logs");

        if (!fs.existsSync(logDir)) {
            return res.json({ success: true, logs: [], totalFiles: 0 });
        }

        const allFiles = fs.readdirSync(logDir).filter(f => f.endsWith(".log"));

        // Belirli dosya istendiyse sadece onu oku
        const filesToRead = targetFile
            ? allFiles.filter(f => f === targetFile)
            : allFiles;

        const logs = [];

        for (const file of filesToRead) {
            try {
                const filePath = path.join(logDir, file);
                const stat = fs.statSync(filePath);

                // ── Büyük dosyalar için son N byte oku (stream yerine tail) ──
                const MAX_READ_BYTES = 512 * 1024; // 512 KB
                const readSize = Math.min(stat.size, MAX_READ_BYTES);
                const buffer = Buffer.alloc(readSize);
                const fd = fs.openSync(filePath, "r");
                fs.readSync(fd, buffer, 0, readSize, Math.max(0, stat.size - readSize));
                fs.closeSync(fd);

                const content = buffer.toString("utf-8");
                // İlk satır kesilmiş olabilir, at
                const rawLines = content.split("\n").filter(Boolean);
                if (stat.size > MAX_READ_BYTES && rawLines.length > 0) {
                    rawLines.shift(); // Kesilmiş ilk satırı at
                }

                // ── Parse + filtrele ──
                let parsedLines = rawLines.map(line => {
                    try {
                        return JSON.parse(line);
                    } catch {
                        // Winston text format: [TIMESTAMP] LEVEL: message
                        const match = line.match(/^\[(.+?)\]\s+(\w+):\s+(.*)$/);
                        if (match) {
                            return { timestamp: match[1], level: match[2].toLowerCase(), message: match[3] };
                        }
                        return { message: line, level: "info", timestamp: new Date().toISOString() };
                    }
                });

                // Seviye filtresi
                if (level) {
                    const lvl = level.toLowerCase();
                    parsedLines = parsedLines.filter(l => (l.level || "").toLowerCase() === lvl);
                }

                // Arama filtresi
                if (search) {
                    const searchLower = search.toLowerCase();
                    parsedLines = parsedLines.filter(l =>
                        (l.message || "").toLowerCase().includes(searchLower)
                    );
                }

                // En yeniler önce (ters sıra)
                parsedLines.reverse();

                logs.push({
                    file,
                    fileSize: formatBytes(stat.size),
                    fileSizeBytes: stat.size,
                    lastModified: stat.mtime.toISOString(),
                    totalLines: parsedLines.length,
                    lines: parsedLines.slice(offset, offset + limit),
                });
            } catch (e) {
                logger.debug(`[AdminSystem] Log dosyası okunamadı: ${file} — ${e.message}`);
            }
        }

        res.json({
            success: true,
            logs,
            totalFiles: allFiles.length,
            availableFiles: allFiles,
            filters: { level: level || null, search: search || null, limit, offset },
        });
    } catch (error) {
        logger.error(`Log okuma hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Loglar okunamadı" });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/admin/system/settings — Sistem ayarları
// ═════════════════════════════════════════════════════════════════════════════
exports.getSystemSettings = async (req, res) => {
    try {
        // ── Dinamik model sayıları ──
        const modelNames = mongoose.modelNames();

        // ── Gerçek rate limit bilgisi ──
        let rateLimitInfo = {};
        try {
            const { apiLimiter, authLimiter } = require("../../middlewares/rateLimiter");
            rateLimitInfo = {
                api: { windowMs: 60000, max: 120, description: "Genel API — 120 istek/dk" },
                auth: { windowMs: 900000, max: 20, description: "Auth — 20 istek/15dk" },
            };
        } catch { /* ignore */ }

        // ── Aktif mongoose bağlantı ayarları ──
        const mongooseOpts = mongoose.connection?.config || {};

        res.json({
            success: true,
            settings: {
                appName: "LysiaETIC",
                version: process.env.npm_package_version || "1.0.0",
                environment: process.env.NODE_ENV || "development",
                port: process.env.PORT || 5000,
                dbConnected: mongoose.connection.readyState === 1,
                dbName: mongoose.connection.name || "-",
                registeredModels: modelNames.length,
                modelNames,
                features: {
                    pwa: true,
                    responsive: true,
                    aiPanel: true,
                    marketplace: true,
                    finance: true,
                    cargo: true,
                    radarPro: true,
                    twoFactorAuth: true,
                    impersonation: true,
                    auditLog: true,
                },
                limits: {
                    maxUploadSize: "10MB",
                    rateLimits: rateLimitInfo,
                    sessionTimeout: "24h",
                    impersonateTimeout: "1h",
                    maxRefreshTokensPerUser: 5,
                },
                security: {
                    jwtConfigured: !!process.env.JWT_SECRET,
                    httpsEnforced: process.env.NODE_ENV === "production",
                    corsEnabled: true,
                    rateLimitEnabled: true,
                    auditLogEnabled: true,
                },
            },
        });
    } catch (error) {
        logger.error(`Ayarlar hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Ayarlar alınamadı" });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/admin/system/audit-logs — Audit log geçmişi (filtreleme + sayfalama)
// ═════════════════════════════════════════════════════════════════════════════
exports.getAuditLogs = async (req, res) => {
    try {
        const {
            category,       // "user", "security", "system", ...
            severity,       // "info", "warning", "error", "critical"
            action,         // "impersonate_user", "delete_user", ...
            userId,         // Belirli kullanıcıya ait
            adminId,        // Belirli admin tarafından
            search,         // Açıklama içinde arama
            startDate,      // ISO tarih
            endDate,        // ISO tarih
            page = 1,
            limit: rawLimit = 50,
        } = req.query;

        const limit = Math.min(parseInt(rawLimit) || 50, 200);
        const skip = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

        // ── Filtre oluştur ──
        const query = {};
        if (category) query.category = category;
        if (severity) query.severity = severity;
        if (action) query.action = { $regex: action, $options: "i" };
        if (userId) query.userId = userId;
        if (adminId) query.adminId = adminId;
        if (search) query.description = { $regex: search, $options: "i" };
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const [logs, total] = await Promise.all([
            AuditLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("userId", "name email")
                .populate("adminId", "name email")
                .lean(),
            AuditLog.countDocuments(query),
        ]);

        // ── Kategori ve severity dağılımı ──
        const [categoryDist, severityDist] = await Promise.all([
            AuditLog.aggregate([
                { $group: { _id: "$category", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            AuditLog.aggregate([
                { $group: { _id: "$severity", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
        ]);

        res.json({
            success: true,
            data: {
                logs,
                pagination: {
                    total,
                    page: Math.max(parseInt(page) || 1, 1),
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
                distributions: {
                    categories: categoryDist.reduce((acc, c) => { acc[c._id || "unknown"] = c.count; return acc; }, {}),
                    severities: severityDist.reduce((acc, s) => { acc[s._id || "unknown"] = s.count; return acc; }, {}),
                },
            },
        });
    } catch (error) {
        logger.error(`Audit log hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Audit loglar yüklenemedi" });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/admin/system/db-health — Veritabanı sağlık detayları
// ═════════════════════════════════════════════════════════════════════════════
exports.getDbHealth = async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({
                success: true,
                data: { connected: false, state: "Bağlantı Yok" },
            });
        }

        const db = mongoose.connection.db;

        // ── Ping testi ──
        const pingStart = Date.now();
        await db.admin().ping();
        const pingMs = Date.now() - pingStart;

        // ── Koleksiyon detayları ──
        const collections = await db.listCollections().toArray();
        const collectionStats = [];

        for (const col of collections.slice(0, 30)) { // Max 30 koleksiyon
            try {
                const stats = await db.collection(col.name).stats();
                collectionStats.push({
                    name: col.name,
                    documents: stats.count || 0,
                    size: formatBytes(stats.size || 0),
                    sizeBytes: stats.size || 0,
                    avgDocSize: formatBytes(stats.avgObjSize || 0),
                    indexes: stats.nindexes || 0,
                    indexSize: formatBytes(stats.totalIndexSize || 0),
                });
            } catch {
                collectionStats.push({ name: col.name, documents: 0, size: "0 B", error: true });
            }
        }

        // Boyuta göre sırala
        collectionStats.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));

        // ── Genel DB istatistikleri ──
        const dbInfo = await db.stats();

        res.json({
            success: true,
            data: {
                connected: true,
                host: mongoose.connection.host,
                name: mongoose.connection.name,
                pingMs,
                stats: {
                    collections: dbInfo.collections || 0,
                    documents: dbInfo.objects || 0,
                    dataSize: formatBytes(dbInfo.dataSize || 0),
                    storageSize: formatBytes(dbInfo.storageSize || 0),
                    indexSize: formatBytes(dbInfo.indexSize || 0),
                },
                collectionDetails: collectionStats,
            },
        });
    } catch (error) {
        logger.error(`DB health hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "DB sağlık bilgisi alınamadı" });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/system/clear-logs — Log dosyalarını temizle
// ═════════════════════════════════════════════════════════════════════════════
exports.clearLogs = async (req, res) => {
    try {
        const { file: targetFile } = req.body;
        const logDir = path.join(__dirname, "../../logs");

        if (!fs.existsSync(logDir)) {
            return res.json({ success: true, message: "Log dizini bulunamadı", cleared: 0 });
        }

        const files = targetFile
            ? [targetFile].filter(f => fs.existsSync(path.join(logDir, f)))
            : fs.readdirSync(logDir).filter(f => f.endsWith(".log"));

        let cleared = 0;
        for (const file of files) {
            try {
                fs.writeFileSync(path.join(logDir, file), "", "utf-8");
                cleared++;
            } catch { /* skip */ }
        }

        await writeAuditLog(req, "clear_logs", "system",
            `${cleared} log dosyası temizlendi${targetFile ? ` (${targetFile})` : " (tümü)"}`,
            { files, cleared }, "warning");

        logger.info(`[AdminSystem] ${cleared} log dosyası temizlendi — admin: ${req.user?.email}`);

        res.json({ success: true, message: `${cleared} log dosyası temizlendi`, cleared });
    } catch (error) {
        logger.error(`Log temizleme hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Loglar temizlenemedi" });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/admin/system/workers — Tüm arka plan worker durumları
// ═════════════════════════════════════════════════════════════════════════════
exports.getWorkerStatuses = async (req, res) => {
    try {
        const workers = {};

        // ── Radar Worker ──
        try {
            const { getRadarWorkerStatus } = require("../../services/radar/radarWorker");
            workers.radar = { ...getRadarWorkerStatus(), name: "LysiaRadar PRO Worker" };
        } catch (e) {
            workers.radar = { isActive: false, name: "LysiaRadar PRO Worker", error: e.message };
        }

        // ── AI Background Worker ──
        try {
            const aiWorker = require("../../services/aiBackgroundWorker");
            workers.ai = { ...aiWorker.getWorkerStatus(), name: "AI Background Worker" };
        } catch (e) {
            workers.ai = { isActive: false, name: "AI Background Worker", error: e.message };
        }

        // ── Genel özet ──
        const activeCount = Object.values(workers).filter(w => w.isActive).length;
        const totalCount = Object.keys(workers).length;

        res.json({
            success: true,
            data: {
                workers,
                summary: {
                    total: totalCount,
                    active: activeCount,
                    inactive: totalCount - activeCount,
                    allHealthy: activeCount === totalCount,
                },
            },
        });
    } catch (error) {
        logger.error(`Worker durumu hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Worker durumları alınamadı" });
    }
};
