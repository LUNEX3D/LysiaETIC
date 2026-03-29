const os = require("os");
const mongoose = require("mongoose");
const User = require("../../models/User");
const logger = require("../../config/logger");

/**
 * Sunucu durumu ve sistem metrikleri
 * GET /api/admin/system/status
 */
exports.getSystemStatus = async (req, res) => {
    try {
        const uptimeSec = Math.floor(process.uptime());
        const uptimeMin = Math.floor(uptimeSec / 60);
        const uptimeHour = Math.floor(uptimeMin / 60);
        const uptimeDay = Math.floor(uptimeHour / 24);

        const memUsage = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        const cpus = os.cpus();
        const cpuModel = cpus[0]?.model || "Bilinmiyor";
        const cpuCount = cpus.length;

        // CPU kullanımı hesapla
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return acc + ((total - idle) / total) * 100;
        }, 0) / cpuCount;

        // DB durumu
        const dbStates = ["Bağlantı Yok", "Bağlı", "Bağlanıyor", "Bağlantı Kesiliyor"];
        const dbState = mongoose.connection.readyState;

        // Kullanıcı istatistikleri
        const totalUsers = await User.countDocuments();
        const adminUsers = await User.countDocuments({ role: "admin" });
        const activeToday = await User.countDocuments({
            updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        res.json({
            success: true,
            server: {
                status: "online",
                uptime: {
                    days: uptimeDay,
                    hours: uptimeHour % 24,
                    minutes: uptimeMin % 60,
                    seconds: uptimeSec % 60,
                    formatted: `${uptimeDay}g ${uptimeHour % 24}s ${uptimeMin % 60}dk ${uptimeSec % 60}sn`
                },
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version,
                pid: process.pid,
                env: process.env.NODE_ENV || "development"
            },
            cpu: {
                model: cpuModel,
                cores: cpuCount,
                usage: Math.round(cpuUsage * 100) / 100
            },
            memory: {
                system: {
                    total: (totalMem / 1024 / 1024 / 1024).toFixed(2) + " GB",
                    used: (usedMem / 1024 / 1024 / 1024).toFixed(2) + " GB",
                    free: (freeMem / 1024 / 1024 / 1024).toFixed(2) + " GB",
                    usagePercent: Math.round((usedMem / totalMem) * 100)
                },
                process: {
                    heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(1) + " MB",
                    heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(1) + " MB",
                    rss: (memUsage.rss / 1024 / 1024).toFixed(1) + " MB",
                    external: (memUsage.external / 1024 / 1024).toFixed(1) + " MB"
                }
            },
            database: {
                state: dbStates[dbState] || "Bilinmiyor",
                stateCode: dbState,
                host: mongoose.connection.host || "-",
                name: mongoose.connection.name || "-",
                connected: dbState === 1
            },
            users: {
                total: totalUsers,
                admins: adminUsers,
                activeToday: activeToday
            },
            os: {
                type: os.type(),
                release: os.release(),
                loadAvg: os.loadavg().map(l => Math.round(l * 100) / 100),
                networkInterfaces: Object.entries(os.networkInterfaces()).reduce((acc, [name, interfaces]) => {
                    const ipv4 = interfaces.find(i => i.family === "IPv4" && !i.internal);
                    if (ipv4) acc[name] = ipv4.address;
                    return acc;
                }, {})
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error(`Sistem durumu hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Sistem durumu alınamadı", error: error.message });
    }
};

/**
 * Sunucu listesi (kayıtlı servisler)
 * GET /api/admin/system/servers
 */
exports.getServers = async (req, res) => {
    try {
        // Dinamik sunucu bilgileri
        const servers = [
            {
                id: "backend-api",
                name: "LysiaETIC Backend API",
                type: "api",
                url: `http://${req.headers.host || "localhost:5000"}`,
                internalUrl: "http://127.0.0.1:5000",
                status: "online",
                port: process.env.PORT || 5000,
                uptime: Math.floor(process.uptime()),
                memory: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + " MB",
                version: "1.0.0",
                description: "Ana API sunucusu - Express.js",
                healthCheck: "/api/status",
                lastCheck: new Date().toISOString()
            },
            {
                id: "frontend-nginx",
                name: "LysiaETIC Frontend",
                type: "web",
                url: `http://${(req.headers.host || "localhost").split(":")[0]}`,
                internalUrl: "http://127.0.0.1:80",
                status: "online",
                port: 80,
                description: "React SPA - Nginx ile serve ediliyor",
                version: "1.0.0",
                healthCheck: "/",
                lastCheck: new Date().toISOString()
            },
            {
                id: "mongodb-atlas",
                name: "MongoDB Atlas",
                type: "database",
                url: mongoose.connection.host ? `mongodb+srv://${mongoose.connection.host}` : "-",
                status: mongoose.connection.readyState === 1 ? "online" : "offline",
                description: `Veritabanı: ${mongoose.connection.name || "-"}`,
                version: "Atlas",
                lastCheck: new Date().toISOString()
            }
        ];

        res.json({ success: true, servers });
    } catch (error) {
        logger.error(`Sunucu listesi hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Sunucu listesi alınamadı" });
    }
};

/**
 * Kullanıcı paneline admin olarak erişim (impersonate)
 * POST /api/admin/system/impersonate/:userId
 */
exports.impersonateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const adminUser = req.user;

        // Sadece admin erişebilir
        if (adminUser.role !== "admin" && adminUser.role !== "dev") {
            return res.status(403).json({ success: false, message: "Bu işlem için admin yetkisi gerekli" });
        }

        const targetUser = await User.findById(userId).select("-password");
        if (!targetUser) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
        }

        // JWT token oluştur (hedef kullanıcı adına)
        const jwt = require("jsonwebtoken");
        const impersonateToken = jwt.sign(
            {
                id: targetUser._id,
                role: targetUser.role,
                impersonatedBy: adminUser._id,
                isImpersonation: true
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        logger.info(`Admin ${adminUser.email} kullanıcı ${targetUser.email} paneline erişim sağladı`);

        res.json({
            success: true,
            message: `${targetUser.name} kullanıcısının paneline erişim sağlandı`,
            token: impersonateToken,
            user: {
                _id: targetUser._id,
                name: targetUser.name,
                email: targetUser.email,
                role: targetUser.role
            }
        });
    } catch (error) {
        logger.error(`Impersonate hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Kullanıcı erişimi sağlanamadı" });
    }
};

/**
 * Admin aktivite logları
 * GET /api/admin/system/logs
 */
exports.getSystemLogs = async (req, res) => {
    try {
        const fs = require("fs");
        const path = require("path");
        const logDir = path.join(__dirname, "../../logs");

        let logs = [];

        if (fs.existsSync(logDir)) {
            const files = fs.readdirSync(logDir).filter(f => f.endsWith(".log"));
            for (const file of files) {
                try {
                    const content = fs.readFileSync(path.join(logDir, file), "utf-8");
                    const lines = content.split("\n").filter(Boolean).slice(-50);
                    logs.push({
                        file,
                        lines: lines.map(line => {
                            try {
                                return JSON.parse(line);
                            } catch {
                                return { message: line, level: "info", timestamp: new Date().toISOString() };
                            }
                        })
                    });
                } catch (e) {
                    // skip unreadable files
                }
            }
        }

        res.json({ success: true, logs });
    } catch (error) {
        logger.error(`Log okuma hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Loglar okunamadı" });
    }
};

/**
 * Sistem ayarları
 * GET /api/admin/system/settings
 */
exports.getSystemSettings = async (req, res) => {
    try {
        res.json({
            success: true,
            settings: {
                appName: "LysiaETIC",
                version: "1.0.0",
                environment: process.env.NODE_ENV || "development",
                port: process.env.PORT || 5000,
                dbConnected: mongoose.connection.readyState === 1,
                features: {
                    pwa: true,
                    responsive: true,
                    aiPanel: true,
                    marketplace: true,
                    finance: true,
                    cargo: true
                },
                limits: {
                    maxUploadSize: "10MB",
                    apiRateLimit: "100/min",
                    sessionTimeout: "24h"
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Ayarlar alınamadı" });
    }
};
