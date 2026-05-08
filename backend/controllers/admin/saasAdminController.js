/**
 * SaaS Admin Controller
 *
 * Yazılım sahibi (SaaS Owner) admin paneli için tüm endpoint'ler.
 * Firma yönetimi, abonelik, ödeme, entegrasyon kontrolü,
 * audit log, duyuru, ticket, global raporlama vs.
 */

const mongoose = require("mongoose");
const os = require("os");
const User = require("../../models/User");
const Order = require("../../models/Order");
const ProductMapping = require("../../models/ProductMapping");
const Marketplace = require("../../models/Marketplace");
const Subscription = require("../../models/Subscription");
const Payment = require("../../models/Payment");
const Ticket = require("../../models/Ticket");
const AuditLog = require("../../models/AuditLog");
const Announcement = require("../../models/Announcement");
const AutoInvoiceConfig = require("../../models/AutoInvoiceConfig");
const Invoice = require("../../models/Invoice");
const AutoOrderConfig = require("../../models/AutoOrderConfig");
const logger = require("../../config/logger");

/* ═══════════════════════════════════════════════════════════
   1. DASHBOARD — Genel Platform Metrikleri
   ═══════════════════════════════════════════════════════════ */
exports.getDashboardMetrics = async (req, res) => {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

        // Kullanıcı metrikleri
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ updatedAt: { $gte: weekAgo } });
        const todayRegistrations = await User.countDocuments({ createdAt: { $gte: today } });
        const weekRegistrations = await User.countDocuments({ createdAt: { $gte: weekAgo } });
        const monthRegistrations = await User.countDocuments({ createdAt: { $gte: monthAgo } });

        // Durum bazlı kullanıcılar
        const suspendedUsers = await User.countDocuments({ "subscription.status": "cancelled" });
        const trialUsers = await User.countDocuments({ "subscription.plan": "trial" });

        // Plan dağılımı
        const planDistribution = await User.aggregate([
            { $group: { _id: "$subscription.plan", count: { $sum: 1 } } }
        ]);

        // Rol dağılımı
        const roleDistribution = await User.aggregate([
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);

        // Sipariş metrikleri
        const totalOrders = await Order.countDocuments();
        const todayOrders = await Order.countDocuments({ createdAt: { $gte: today } });
        const weekOrders = await Order.countDocuments({ createdAt: { $gte: weekAgo } });

        // Gelir metrikleri
        const revenueAgg = await Order.aggregate([
            { $group: { _id: null, total: { $sum: "$totalPrice" } } }
        ]);
        const totalRevenue = revenueAgg[0]?.total || 0;

        const todayRevenueAgg = await Order.aggregate([
            { $match: { createdAt: { $gte: today } } },
            { $group: { _id: null, total: { $sum: "$totalPrice" } } }
        ]);
        const todayRevenue = todayRevenueAgg[0]?.total || 0;

        // Ürün metrikleri
        const totalProducts = await ProductMapping.countDocuments();

        // Entegrasyon metrikleri
        const totalIntegrations = await Marketplace.countDocuments();
        const marketplaceDistribution = await Marketplace.aggregate([
            { $group: { _id: "$marketplaceName", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Abonelik metrikleri
        const totalSubscriptions = await Subscription.countDocuments();
        const activeSubscriptions = await Subscription.countDocuments({ status: "active" });
        const trialSubscriptions = await Subscription.countDocuments({ status: "trial" });
        const expiredSubscriptions = await Subscription.countDocuments({ status: "expired" });

        // Ödeme metrikleri
        const totalPayments = await Payment.countDocuments({ status: "completed" });
        const platformRevenueAgg = await Payment.aggregate([
            { $match: { status: "completed" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const platformRevenue = platformRevenueAgg[0]?.total || 0;

        const monthlyRevenueAgg = await Payment.aggregate([
            { $match: { status: "completed", createdAt: { $gte: monthAgo } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const monthlyRevenue = monthlyRevenueAgg[0]?.total || 0;

        // Ticket metrikleri
        const openTickets = await Ticket.countDocuments({ status: { $in: ["open", "in_progress"] } });
        const totalTickets = await Ticket.countDocuments();

        // Son 7 gün kayıt trendi
        const registrationTrend = [];
        for (let i = 6; i >= 0; i--) {
            const dayStart = new Date(now);
            dayStart.setDate(dayStart.getDate() - i);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);
            const count = await User.countDocuments({ createdAt: { $gte: dayStart, $lte: dayEnd } });
            registrationTrend.push({
                date: dayStart.toISOString().split("T")[0],
                label: dayStart.toLocaleDateString("tr-TR", { weekday: "short" }),
                count
            });
        }

        // Sistem metrikleri
        const uptimeSec = Math.floor(process.uptime());
        const cpus = os.cpus();
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return acc + ((total - idle) / total) * 100;
        }, 0) / cpus.length;

        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memUsagePercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

        // API kullanım (basit in-memory — server.js stats'tan)
        let apiStats = { total: 0, success: 0, clientErr: 0, serverErr: 0 };
        try {
            // server.js'deki stats objesine erişim
            apiStats = global.__apiStats || apiStats;
        } catch {}

        res.json({
            success: true,
            users: {
                total: totalUsers,
                active: activeUsers,
                suspended: suspendedUsers,
                trial: trialUsers,
                todayRegistrations,
                weekRegistrations,
                monthRegistrations,
                planDistribution: planDistribution.reduce((acc, p) => { acc[p._id || "free"] = p.count; return acc; }, {}),
                roleDistribution: roleDistribution.reduce((acc, r) => { acc[r._id || "user"] = r.count; return acc; }, {}),
                registrationTrend,
            },
            orders: {
                total: totalOrders,
                today: todayOrders,
                week: weekOrders,
                totalRevenue,
                todayRevenue,
            },
            products: { total: totalProducts },
            integrations: {
                total: totalIntegrations,
                distribution: marketplaceDistribution.map(m => ({ name: m._id, count: m.count })),
            },
            subscriptions: {
                total: totalSubscriptions,
                active: activeSubscriptions,
                trial: trialSubscriptions,
                expired: expiredSubscriptions,
            },
            payments: {
                totalCompleted: totalPayments,
                platformRevenue,
                monthlyRevenue,
            },
            tickets: {
                open: openTickets,
                total: totalTickets,
            },
            system: {
                uptime: uptimeSec,
                uptimeFormatted: `${Math.floor(uptimeSec / 86400)}g ${Math.floor((uptimeSec % 86400) / 3600)}s ${Math.floor((uptimeSec % 3600) / 60)}dk`,
                cpuUsage: Math.round(cpuUsage * 100) / 100,
                cpuCores: cpus.length,
                memoryUsage: memUsagePercent,
                memoryTotal: (totalMem / 1024 / 1024 / 1024).toFixed(1) + " GB",
                nodeVersion: process.version,
                platform: os.platform(),
                hostname: os.hostname(),
                dbConnected: mongoose.connection.readyState === 1,
                pid: process.pid,
                env: process.env.NODE_ENV || "development",
            },
            apiStats,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error(`SaaS Dashboard hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Dashboard verileri alınamadı" });
    }
};

/* ═══════════════════════════════════════════════════════════
   2. FİRMA (TENANT) YÖNETİMİ
   ═══════════════════════════════════════════════════════════ */
exports.getTenants = async (req, res) => {
    try {
        const users = await User.find().select("-password").sort({ createdAt: -1 });
        const now = new Date();

        // Her kullanıcı için ek bilgiler
        const enriched = await Promise.all(users.map(async (user) => {
            const u = user.toObject();
            try {
                const [mpCount, productCount, orderCount, orderRevenue, subscription] = await Promise.all([
                    Marketplace.countDocuments({ userId: user._id }),
                    ProductMapping.countDocuments({ userId: user._id }),
                    Order.countDocuments({ user: user._id }),
                    Order.aggregate([
                        { $match: { user: user._id } },
                        { $group: { _id: null, total: { $sum: "$totalPrice" } } }
                    ]),
                    Subscription.findOne({ userId: user._id }).sort({ createdAt: -1 }),
                ]);

                u.stats = {
                    marketplaces: mpCount,
                    products: productCount,
                    orders: orderCount,
                    revenue: orderRevenue[0]?.total || 0,
                };
                u.activeSubscription = subscription || null;
            } catch {
                u.stats = { marketplaces: 0, products: 0, orders: 0, revenue: 0 };
                u.activeSubscription = null;
            }

            // ✅ Gerçek abonelik durumunu hesapla — DB'deki status güncel olmayabilir
            const sub = u.subscription || {};
            let computedStatus = sub.status || "none";
            if (["admin", "dev"].includes(u.role)) {
                computedStatus = "active"; // Admin/dev her zaman aktif
            } else if (sub.status === "trial" || sub.plan === "trial") {
                const trialEnd = sub.trialEndDate ? new Date(sub.trialEndDate) : null;
                if (!trialEnd || trialEnd <= now) computedStatus = "expired";
                else computedStatus = "trial";
            } else if (sub.status === "active") {
                const endDate = sub.endDate ? new Date(sub.endDate) : null;
                if (endDate && endDate <= now) computedStatus = "expired";
            } else if (!sub.status || sub.status === "none") {
                computedStatus = "expired";
            }
            u.computedSubscriptionStatus = computedStatus;

            // Kalan gün hesapla
            const relevantEnd = sub.endDate || sub.trialEndDate;
            if (relevantEnd) {
                const endMs = new Date(relevantEnd).getTime();
                u.subscriptionDaysLeft = Math.ceil((endMs - now.getTime()) / (1000 * 60 * 60 * 24));
            } else {
                u.subscriptionDaysLeft = 0;
            }

            return u;
        }));

        res.json({ success: true, tenants: enriched });
    } catch (error) {
        logger.error(`Tenant listesi hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Firma listesi alınamadı" });
    }
};

exports.getTenantDetail = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password -refreshTokens -security.twoFactorSecret -security.twoFactorBackupCodes");
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

        const uid = user._id;

        // Tüm verileri paralel çek
        const [
            marketplaces, productCount, orders, subscription, payments, tickets,
            autoInvoiceConfig, invoiceCount, recentInvoices, autoOrderConfigs
        ] = await Promise.all([
            Marketplace.find({ userId: uid }).lean(),
            ProductMapping.countDocuments({ userId: uid }),
            Order.find({ user: uid }).sort({ createdAt: -1 }).limit(20).lean(),
            Subscription.findOne({ userId: uid }).sort({ createdAt: -1 }).lean(),
            Payment.find({ userId: uid }).sort({ createdAt: -1 }).limit(10).lean(),
            Ticket.find({ userId: uid }).sort({ createdAt: -1 }).limit(10).lean(),
            AutoInvoiceConfig.findOne({ userId: uid }).lean(),
            Invoice.countDocuments({ userId: uid }),
            Invoice.find({ userId: uid }).sort({ createdAt: -1 }).limit(10).lean(),
            AutoOrderConfig.find({ user: uid }).lean(),
        ]);

        // Sipariş istatistikleri
        const orderRevenue = await Order.aggregate([
            { $match: { user: uid } },
            { $group: { _id: null, total: { $sum: "$totalPrice" }, count: { $sum: 1 } } }
        ]);

        // Pazaryeri bazında sipariş dağılımı
        const ordersByMarketplace = await Order.aggregate([
            { $match: { user: uid } },
            { $group: { _id: "$marketplaceName", count: { $sum: 1 }, revenue: { $sum: "$totalPrice" } } },
            { $sort: { count: -1 } }
        ]);

        // Fatura istatistikleri
        const invoiceStats = await Invoice.aggregate([
            { $match: { userId: uid } },
            { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$totals.payableAmount" } } }
        ]);

        // ── Entegrasyon detayları (credential'ları maskele) ────────────
        const safeMarketplaces = marketplaces.map(mp => {
            const creds = mp.credentials || {};
            const maskedCreds = {};
            for (const [key, val] of Object.entries(creds)) {
                if (typeof val === "string" && (key.toLowerCase().includes("secret") || key.toLowerCase().includes("password"))) {
                    maskedCreds[key] = val ? "••••" + val.slice(-4) : "";
                } else {
                    maskedCreds[key] = val;
                }
            }
            return { ...mp, credentials: maskedCreds };
        });

        // ── QNB credential'ları maskele ─────────────────────────
        let safeInvoiceConfig = null;
        if (autoInvoiceConfig) {
            const qnb = autoInvoiceConfig.qnbCredentials || {};
            safeInvoiceConfig = {
                ...autoInvoiceConfig,
                qnbCredentials: {
                    earsivUsername: qnb.earsivUsername || "",
                    earsivPassword: qnb.earsivPassword ? "••••" + qnb.earsivPassword.slice(-3) : "",
                    efaturaUsername: qnb.efaturaUsername || "",
                    efaturaPassword: qnb.efaturaPassword ? "••••" + qnb.efaturaPassword.slice(-3) : "",
                    env: qnb.env || "test",
                    // Eski alanlar
                    username: qnb.username || "",
                    password: qnb.password ? "••••" : "",
                },
            };
        }

        // ── User.companyInfo QNB maskele ───────────────────────
        const tenantObj = user.toObject();
        if (tenantObj.companyInfo?.qnb) {
            const q = tenantObj.companyInfo.qnb;
            tenantObj.companyInfo.qnb = {
                earsivUsername: q.earsivUsername || "",
                earsivPassword: q.earsivPassword ? "••••" + q.earsivPassword.slice(-3) : "",
                efaturaUsername: q.efaturaUsername || "",
                efaturaPassword: q.efaturaPassword ? "••••" + q.efaturaPassword.slice(-3) : "",
                env: q.env || "test",
            };
        }

        res.json({
            success: true,
            tenant: tenantObj,
            // Entegrasyonlar
            marketplaces: safeMarketplaces,
            // Ürünler
            productCount,
            // Siparişler
            recentOrders: orders,
            orderStats: {
                total: orderRevenue[0]?.count || 0,
                revenue: orderRevenue[0]?.total || 0,
                byMarketplace: ordersByMarketplace.map(m => ({ marketplace: m._id || "Diğer", count: m.count, revenue: m.revenue })),
            },
            // Abonelik & Ödeme
            subscription: subscription || null,
            payments,
            // Faturalama
            invoiceConfig: safeInvoiceConfig,
            invoiceStats: {
                total: invoiceCount,
                byStatus: invoiceStats.map(s => ({ status: s._id, count: s.count, total: s.total })),
            },
            recentInvoices: recentInvoices.map(inv => ({
                _id: inv._id,
                invoiceNumber: inv.invoiceNumber || "",
                uuid: inv.uuid || "",
                profileId: inv.profileId || "",
                status: inv.status || "",
                issueDate: inv.issueDate,
                customer: inv.customer?.name || "",
                total: inv.totals?.payableAmount || 0,
                marketplace: inv.marketplaceName || "",
                createdBy: inv.createdBy || "",
            })),
            // Otomatik Sipariş Ayarları
            autoOrderConfigs: autoOrderConfigs.map(c => ({
                marketplace: c.marketplaceName,
                enabled: c.enabled,
                primaryCargo: c.primaryCargo?.name || "",
                fallbackCargo: c.fallbackCargo?.name || "",
                stats: c.stats || {},
            })),
            // Destek
            tickets,
        });
    } catch (error) {
        logger.error(`Tenant detay hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Firma detayı alınamadı" });
    }
};

exports.suspendTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

        // Aboneliği askıya al
        await Subscription.updateMany(
            { userId: id, status: { $in: ["active", "trial"] } },
            { $set: { status: "suspended", notes: reason || "Admin tarafından askıya alındı" } }
        );

        // Kullanıcı subscription durumunu güncelle
        user.subscription = user.subscription || {};
        user.subscription.status = "cancelled";
        user.markModified("subscription");
        await user.save();

        // Audit log
        await AuditLog.create({
            userId: id,
            adminId: req.user._id,
            action: "tenant_suspended",
            category: "user",
            severity: "warning",
            description: `Firma askıya alındı: ${user.name} (${user.email}). Sebep: ${reason || "Belirtilmedi"}`,
            ipAddress: req.ip,
        });

        res.json({ success: true, message: "Firma askıya alındı" });
    } catch (error) {
        logger.error(`Firma askıya alma hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "İşlem başarısız" });
    }
};

exports.activateTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

        await Subscription.updateMany(
            { userId: id, status: "suspended" },
            { $set: { status: "active" } }
        );

        user.subscription = user.subscription || {};
        user.subscription.status = "active";
        user.markModified("subscription");
        await user.save();

        await AuditLog.create({
            userId: id,
            adminId: req.user._id,
            action: "tenant_activated",
            category: "user",
            severity: "info",
            description: `Firma aktifleştirildi: ${user.name} (${user.email})`,
            ipAddress: req.ip,
        });

        res.json({ success: true, message: "Firma aktifleştirildi" });
    } catch (error) {
        logger.error(`Firma aktifleştirme hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "İşlem başarısız" });
    }
};

/**
 * Admin: Kullanıcı abonelik süresini uzat / plan değiştir
 * POST /saas-admin/tenants/:id/extend-subscription
 * Body: { plan, days, endDate, status }
 */
exports.extendSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const { plan, days, endDate, status } = req.body;

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

        const now = new Date();
        user.subscription = user.subscription || {};

        // Yeni bitiş tarihi hesapla
        let newEndDate;
        if (endDate) {
            // Doğrudan tarih verilmişse
            newEndDate = new Date(endDate);
        } else if (days) {
            // Mevcut bitiş tarihinden veya şu andan itibaren gün ekle
            const currentEnd = user.subscription.endDate ? new Date(user.subscription.endDate) : now;
            const base = currentEnd > now ? currentEnd : now;
            newEndDate = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
        } else {
            // Varsayılan: 30 gün
            newEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        }

        // Plan güncelle
        const newPlan = plan || user.subscription.plan || "trial";
        const newStatus = status || "active";

        user.subscription.plan = newPlan;
        user.subscription.status = newStatus;
        user.subscription.startDate = user.subscription.startDate || now;
        user.subscription.endDate = newEndDate;
        // Trial alanlarını da güncelle (subscriptionMiddleware ikisini de kontrol ediyor)
        if (newPlan === "trial") {
            user.subscription.trialEndDate = newEndDate;
        }
        user.markModified("subscription");
        await user.save();

        // Subscription koleksiyonunu da güncelle (varsa)
        const existingSub = await Subscription.findOne({ userId: id }).sort({ createdAt: -1 });
        if (existingSub) {
            existingSub.plan = newPlan;
            existingSub.status = newStatus;
            existingSub.endDate = newEndDate;
            await existingSub.save();
        }

        // Audit log
        const daysLeft = Math.ceil((newEndDate - now) / (1000 * 60 * 60 * 24));
        await AuditLog.create({
            userId: id,
            adminId: req.user._id,
            action: "subscription_extended",
            category: "subscription",
            severity: "info",
            description: `Abonelik uzatıldı: ${user.name} (${user.email}) — Plan: ${newPlan}, Bitiş: ${newEndDate.toISOString().slice(0, 10)}, Kalan: ${daysLeft} gün`,
            metadata: { plan: newPlan, endDate: newEndDate, days: daysLeft },
            ipAddress: req.ip,
        });

        logger.info(`✅ [Admin] Abonelik uzatıldı: ${user.email} — ${newPlan} / ${newEndDate.toISOString().slice(0, 10)} (${daysLeft} gün)`);

        res.json({
            success: true,
            message: `Abonelik uzatıldı — ${daysLeft} gün kaldı`,
            subscription: user.subscription,
        });
    } catch (error) {
        logger.error(`Abonelik uzatma hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Abonelik uzatılamadı" });
    }
};

exports.banTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

        // Tüm abonelikleri iptal et
        await Subscription.updateMany(
            { userId: id },
            { $set: { status: "cancelled", cancelReason: reason || "Banlandı", cancelledAt: new Date() } }
        );

        user.subscription = user.subscription || {};
        user.subscription.status = "cancelled";
        user.role = "user"; // Yetkileri düşür
        user.markModified("subscription");
        await user.save();

        await AuditLog.create({
            userId: id,
            adminId: req.user._id,
            action: "tenant_banned",
            category: "security",
            severity: "critical",
            description: `Firma banlandı: ${user.name} (${user.email}). Sebep: ${reason || "Belirtilmedi"}`,
            ipAddress: req.ip,
        });

        res.json({ success: true, message: "Firma banlandı" });
    } catch (error) {
        logger.error(`Firma banlama hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "İşlem başarısız" });
    }
};

/* ═══════════════════════════════════════════════════════════
   3. ABONELİK YÖNETİMİ
   Tek doğru kaynak: User.subscription (middleware & ödeme akışı).
   Subscription koleksiyonu fatura/limit yan kaydı olarak senkron tutulur.
   ═══════════════════════════════════════════════════════════ */

/** Admin listesi için satır — User + isteğe bağlı Subscription belgesi */
function buildSubscriptionListRow(userLean, subDoc, now = new Date()) {
    const us = userLean.subscription || {};
    const plan = us.plan || subDoc?.plan || "trial";
    const status = us.status || subDoc?.status || "trial";
    const startDate = us.startDate || subDoc?.startDate || null;
    const endDate = us.endDate || us.trialEndDate || subDoc?.endDate || null;
    let daysLeft = null;
    let isExpired = false;
    if (endDate) {
        const d = new Date(endDate);
        daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        isExpired = daysLeft <= 0;
    }
    return {
        _id: subDoc?._id || userLean._id,
        userId: { _id: userLean._id, name: userLean.name, email: userLean.email, role: userLean.role },
        plan,
        status,
        startDate,
        endDate,
        limits: subDoc?.limits,
        price: subDoc?.price ?? 0,
        billingCycle: subDoc?.billingCycle || "monthly",
        currency: subDoc?.currency || "TRY",
        daysLeft: daysLeft != null ? Math.max(0, daysLeft) : null,
        isExpired,
        hasSubscriptionDoc: !!subDoc,
    };
}

exports.getSubscriptions = async (req, res) => {
    try {
        const now = new Date();
        const users = await User.find({ role: { $nin: ["admin", "dev", "moderator"] } })
            .select("name email role subscription updatedAt")
            .sort({ updatedAt: -1 })
            .lean();

        const userIds = users.map((u) => u._id);
        const subDocs = await Subscription.find({ userId: { $in: userIds } })
            .sort({ createdAt: -1 })
            .lean();
        const subByUser = new Map();
        for (const s of subDocs) {
            const k = String(s.userId);
            if (!subByUser.has(k)) subByUser.set(k, s);
        }

        const subscriptions = users.map((u) =>
            buildSubscriptionListRow(u, subByUser.get(String(u._id)), now)
        );

        res.json({ success: true, subscriptions });
    } catch (error) {
        logger.error(`Abonelik listesi: ${error.message}`);
        res.status(500).json({ success: false, message: "Abonelikler alınamadı" });
    }
};

exports.updateSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };
        delete updates._id;
        delete updates.userId;

        const VALID_PLANS = new Set(["free", "trial", "basic", "pro", "enterprise"]);
        const VALID_STATUS = new Set(["active", "trial", "suspended", "cancelled", "expired"]);
        const VALID_BILLING = new Set(["monthly", "yearly"]);

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Geçersiz kimlik" });
        }
        if (updates.plan != null && !VALID_PLANS.has(String(updates.plan))) {
            return res.status(400).json({ success: false, message: "Geçersiz plan değeri" });
        }
        if (updates.status != null && !VALID_STATUS.has(String(updates.status))) {
            return res.status(400).json({ success: false, message: "Geçersiz durum değeri" });
        }
        if (updates.billingCycle != null && !VALID_BILLING.has(String(updates.billingCycle))) {
            return res.status(400).json({ success: false, message: "Geçersiz döngü değeri" });
        }
        if (updates.price != null && (Number.isNaN(Number(updates.price)) || Number(updates.price) < 0)) {
            return res.status(400).json({ success: false, message: "Geçersiz fiyat değeri" });
        }

        let userId;
        const subById = await Subscription.findById(id);
        if (subById) {
            userId = subById.userId;
        } else {
            const u = await User.findById(id).select("_id");
            if (!u) return res.status(404).json({ success: false, message: "Abonelik veya kullanıcı bulunamadı" });
            userId = u._id;
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

        const existingSub = user.subscription && typeof user.subscription.toObject === "function"
            ? user.subscription.toObject()
            : { ...(user.subscription || {}) };

        const nextPlan = updates.plan != null ? updates.plan : existingSub.plan;
        const nextStatus = updates.status != null ? updates.status : existingSub.status;
        const nextStart = updates.startDate != null ? new Date(updates.startDate) : (existingSub.startDate ? new Date(existingSub.startDate) : new Date());
        const nextEnd = updates.endDate != null ? new Date(updates.endDate) : (existingSub.endDate ? new Date(existingSub.endDate) : null);
        if (Number.isNaN(nextStart.getTime())) {
            return res.status(400).json({ success: false, message: "Geçersiz başlangıç tarihi" });
        }
        if (nextEnd && Number.isNaN(nextEnd.getTime())) {
            return res.status(400).json({ success: false, message: "Geçersiz bitiş tarihi" });
        }
        if (nextEnd && nextEnd <= nextStart) {
            return res.status(400).json({ success: false, message: "Bitiş tarihi başlangıçtan sonra olmalıdır" });
        }

        const nextUserSub = {
            ...existingSub,
            plan: nextPlan,
            status: nextStatus,
            startDate: nextStart,
            endDate: nextEnd,
        };

        if (nextStatus === "trial" || nextPlan === "trial") {
            nextUserSub.trialStartDate = nextStart;
            nextUserSub.trialEndDate = nextEnd || nextUserSub.trialEndDate;
        } else {
            // Trial dışına geçişte eski trial alanlarını temizle
            delete nextUserSub.trialStartDate;
            delete nextUserSub.trialEndDate;
            nextUserSub.trialUsed = true;
        }

        user.subscription = nextUserSub;
        user.markModified("subscription");
        await user.save();

        const subSet = {
            userId,
            plan: nextPlan,
            status: nextStatus,
            startDate: nextStart,
            endDate: nextEnd,
        };
        if (updates.price != null) subSet.price = Number(updates.price);
        if (updates.billingCycle != null) subSet.billingCycle = updates.billingCycle;
        if (updates.limits != null) subSet.limits = updates.limits;
        if (updates.currency != null) subSet.currency = updates.currency;

        const subDoc = await Subscription.findOneAndUpdate(
            { userId },
            { $set: subSet },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        await AuditLog.create({
            userId,
            adminId: req.user._id,
            action: "subscription_updated",
            category: "subscription",
            severity: "info",
            description: `Abonelik güncellendi: ${user.email} → plan=${nextPlan}, durum=${nextStatus}`,
            metadata: updates,
            ipAddress: req.ip,
        });

        const userLean = await User.findById(userId).select("name email role subscription").lean();
        res.json({
            success: true,
            subscription: buildSubscriptionListRow(userLean, subDoc.toObject ? subDoc.toObject() : subDoc),
        });
    } catch (error) {
        logger.error(`Abonelik güncelleme: ${error.message}`);
        res.status(500).json({ success: false, message: "Abonelik güncellenemedi" });
    }
};

exports.createSubscription = async (req, res) => {
    try {
        const { userId, plan, status, startDate, endDate, limits, price, billingCycle } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

        await Subscription.updateMany(
            { userId, status: { $in: ["active", "trial"] } },
            { $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: "Yeni abonelik ile değiştirildi" } }
        );

        const fallbackLimits = {
            trial: { maxProducts: 50, maxOrders: 100, maxMarketplaces: 1, maxApiCalls: 5000, maxUsers: 1 },
            basic: { maxProducts: 500, maxOrders: 5000, maxMarketplaces: 3, maxApiCalls: 50000, maxUsers: 3 },
            pro: { maxProducts: 5000, maxOrders: 50000, maxMarketplaces: 10, maxApiCalls: 500000, maxUsers: 10 },
            enterprise: { maxProducts: 999999, maxOrders: 999999, maxMarketplaces: 999, maxApiCalls: 9999999, maxUsers: 999 },
        };

        const planKey = plan || "trial";
        let planDefs = {};
        try {
            planDefs = await getPlanDefinitions();
        } catch {
            planDefs = {};
        }
        const limitsResolved =
            limits ||
            planDefs[planKey]?.limits ||
            fallbackLimits[planKey] ||
            fallbackLimits.trial;

        const start = startDate ? new Date(startDate) : new Date();
        const end = endDate
            ? new Date(endDate)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const st = status || "active";
        const pl = planKey;
        const effectiveStatus = st === "trial" || pl === "trial" ? "trial" : st;

        const existingSub = user.subscription && typeof user.subscription.toObject === "function"
            ? user.subscription.toObject()
            : { ...(user.subscription || {}) };

        user.subscription = {
            ...existingSub,
            plan: pl,
            status: effectiveStatus,
            startDate: start,
            endDate: end,
            grantedBy: req.user._id,
            grantedAt: new Date(),
            grantNote: `SaaS admin panel — ${pl} (${effectiveStatus}) aboneliği verildi`,
        };
        if (effectiveStatus === "trial" || pl === "trial") {
            user.subscription.trialStartDate = start;
            user.subscription.trialEndDate = end;
        } else {
            delete user.subscription.trialStartDate;
            delete user.subscription.trialEndDate;
            user.subscription.trialUsed = true;
        }
        user.markModified("subscription");
        await user.save();

        const sub = await Subscription.create({
            userId,
            plan: pl,
            status: effectiveStatus,
            startDate: start,
            endDate: end,
            trialEndDate: effectiveStatus === "trial" ? end : undefined,
            limits: limitsResolved,
            price: price != null ? Number(price) : 0,
            billingCycle: billingCycle || "monthly",
        });

        await AuditLog.create({
            userId,
            adminId: req.user._id,
            action: "subscription_created",
            category: "subscription",
            severity: "info",
            description: `Yeni abonelik: ${user.name} → ${pl} (${effectiveStatus})`,
            ipAddress: req.ip,
        });

        const userLean = await User.findById(userId).select("name email role subscription").lean();
        res.json({
            success: true,
            subscription: buildSubscriptionListRow(userLean, sub.toObject()),
        });
    } catch (error) {
        logger.error(`Abonelik oluşturma hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Abonelik oluşturulamadı" });
    }
};

/* ═══════════════════════════════════════════════════════════
   4. ÖDEME & FATURALANDIRMA
   ═══════════════════════════════════════════════════════════ */
exports.getPayments = async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate("userId", "name email")
            .sort({ createdAt: -1 });
        res.json({ success: true, payments });
    } catch (error) {
        res.status(500).json({ success: false, message: "Ödemeler alınamadı" });
    }
};

exports.createPayment = async (req, res) => {
    try {
        const { userId, amount, currency, status, paymentMethod, description, invoiceNumber } = req.body;

        const payment = await Payment.create({
            userId,
            amount,
            currency: currency || "TRY",
            status: status || "completed",
            paymentMethod: paymentMethod || "credit_card",
            description,
            invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
            paidAt: status === "completed" ? new Date() : null,
        });

        await AuditLog.create({
            userId,
            adminId: req.user._id,
            action: "payment_created",
            category: "payment",
            severity: "info",
            description: `Ödeme kaydı oluşturuldu: ${amount} ${currency || "TRY"}`,
            ipAddress: req.ip,
        });

        res.json({ success: true, payment });
    } catch (error) {
        res.status(500).json({ success: false, message: "Ödeme kaydı oluşturulamadı" });
    }
};

exports.updatePaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, refundReason } = req.body;

        const updates = { status };
        if (status === "completed") updates.paidAt = new Date();
        if (status === "refunded") {
            updates.refundedAt = new Date();
            updates.refundReason = refundReason;
        }

        const payment = await Payment.findByIdAndUpdate(id, updates, { new: true });
        if (!payment) return res.status(404).json({ success: false, message: "Ödeme bulunamadı" });

        res.json({ success: true, payment });
    } catch (error) {
        res.status(500).json({ success: false, message: "Ödeme durumu güncellenemedi" });
    }
};

/* ═══════════════════════════════════════════════════════════
   5. ENTEGRASYON KONTROLÜ
   ═══════════════════════════════════════════════════════════ */
exports.getAllIntegrations = async (req, res) => {
    try {
        const integrations = await Marketplace.find()
            .populate("userId", "name email")
            .sort({ createdAt: -1 });

        // Her entegrasyon için ürün ve sipariş sayısı
        const enriched = await Promise.all(integrations.map(async (mp) => {
            const m = mp.toObject();
            try {
                m.productCount = await ProductMapping.countDocuments({
                    userId: mp.userId?._id || mp.userId,
                    "marketplaceMappings.marketplaceName": mp.marketplaceName
                });
                m.orderCount = await Order.countDocuments({
                    user: mp.userId?._id || mp.userId,
                    marketplaceName: mp.marketplaceName
                });
            } catch {
                m.productCount = 0;
                m.orderCount = 0;
            }
            return m;
        }));

        res.json({ success: true, integrations: enriched });
    } catch (error) {
        res.status(500).json({ success: false, message: "Entegrasyonlar alınamadı" });
    }
};

/* ═══════════════════════════════════════════════════════════
   6. KULLANIM LİMİTLERİ (Usage)
   ═══════════════════════════════════════════════════════════ */
exports.getUsageStats = async (req, res) => {
    try {
        const users = await User.find().select("name email subscription").lean();

        const usageData = await Promise.all(users.map(async (user) => {
            const [productCount, orderCount, mpCount] = await Promise.all([
                ProductMapping.countDocuments({ userId: user._id }),
                Order.countDocuments({ user: user._id }),
                Marketplace.countDocuments({ userId: user._id }),
            ]);

            const sub = await Subscription.findOne({ userId: user._id, status: { $in: ["active", "trial"] } }).lean();

            return {
                userId: user._id,
                name: user.name,
                email: user.email,
                plan: sub?.plan || user.subscription?.plan || "free",
                usage: { products: productCount, orders: orderCount, marketplaces: mpCount },
                limits: sub?.limits || { maxProducts: 100, maxOrders: 1000, maxMarketplaces: 2 },
                overLimit: {
                    products: productCount > (sub?.limits?.maxProducts || 100),
                    orders: orderCount > (sub?.limits?.maxOrders || 1000),
                    marketplaces: mpCount > (sub?.limits?.maxMarketplaces || 2),
                },
            };
        }));

        // Limit aşanlar
        const overLimitUsers = usageData.filter(u =>
            u.overLimit.products || u.overLimit.orders || u.overLimit.marketplaces
        );

        res.json({ success: true, usage: usageData, overLimitUsers, totalUsers: users.length });
    } catch (error) {
        res.status(500).json({ success: false, message: "Kullanım verileri alınamadı" });
    }
};

/* ═══════════════════════════════════════════════════════════
   7. GLOBAL RAPORLAMA
   ═══════════════════════════════════════════════════════════ */
exports.getGlobalReports = async (req, res) => {
    try {
        const now = new Date();
        const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const prevMonthStart = new Date(now - 60 * 24 * 60 * 60 * 1000);

        // Aylık platform geliri
        const monthlyRevenue = await Payment.aggregate([
            { $match: { status: "completed", createdAt: { $gte: monthAgo } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        const prevMonthRevenue = await Payment.aggregate([
            { $match: { status: "completed", createdAt: { $gte: prevMonthStart, $lt: monthAgo } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        // En çok kazandıran firmalar (top 10)
        const topRevenueTenants = await Order.aggregate([
            { $group: { _id: "$user", totalRevenue: { $sum: "$totalPrice" }, orderCount: { $sum: 1 } } },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
            { $project: { name: "$user.name", email: "$user.email", totalRevenue: 1, orderCount: 1 } }
        ]);

        // Churn (son 30 günde iptal edilen abonelikler)
        const churnCount = await Subscription.countDocuments({
            cancelledAt: { $gte: monthAgo },
            status: "cancelled"
        });

        // Yeni abonelikler (son 30 gün)
        const newSubscriptions = await Subscription.countDocuments({
            createdAt: { $gte: monthAgo }
        });

        // Günlük gelir trendi (son 30 gün)
        const dailyRevenue = [];
        for (let i = 29; i >= 0; i--) {
            const dayStart = new Date(now);
            dayStart.setDate(dayStart.getDate() - i);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);

            const rev = await Payment.aggregate([
                { $match: { status: "completed", createdAt: { $gte: dayStart, $lte: dayEnd } } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);

            dailyRevenue.push({
                date: dayStart.toISOString().split("T")[0],
                revenue: rev[0]?.total || 0,
            });
        }

        // Plan bazlı gelir
        const revenueByPlan = await Subscription.aggregate([
            { $match: { status: "active" } },
            { $group: { _id: "$plan", count: { $sum: 1 }, totalPrice: { $sum: "$price" } } }
        ]);

        res.json({
            success: true,
            monthlyRevenue: monthlyRevenue[0]?.total || 0,
            prevMonthRevenue: prevMonthRevenue[0]?.total || 0,
            revenueGrowth: prevMonthRevenue[0]?.total
                ? (((monthlyRevenue[0]?.total || 0) - prevMonthRevenue[0].total) / prevMonthRevenue[0].total * 100).toFixed(1)
                : 0,
            topRevenueTenants,
            churnCount,
            newSubscriptions,
            churnRate: newSubscriptions > 0 ? ((churnCount / newSubscriptions) * 100).toFixed(1) : 0,
            dailyRevenue,
            revenueByPlan,
        });
    } catch (error) {
        logger.error(`Global rapor hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Raporlar alınamadı" });
    }
};

/* ═══════════════════════════════════════════════════════════
   8. BİLDİRİM & DUYURU SİSTEMİ
   ═══════════════════════════════════════════════════════════ */
exports.getAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcement.find()
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 });
        res.json({ success: true, announcements });
    } catch (error) {
        res.status(500).json({ success: false, message: "Duyurular alınamadı" });
    }
};

exports.createAnnouncement = async (req, res) => {
    try {
        const { title, message, type, priority, targetUsers, targetPlan, endDate } = req.body;

        const announcement = await Announcement.create({
            title,
            message,
            type: type || "info",
            priority: priority || "medium",
            targetUsers: targetUsers || "all",
            targetPlan,
            endDate,
            createdBy: req.user._id,
        });

        await AuditLog.create({
            adminId: req.user._id,
            action: "announcement_created",
            category: "system",
            severity: "info",
            description: `Duyuru oluşturuldu: ${title}`,
            ipAddress: req.ip,
        });

        res.json({ success: true, announcement });
    } catch (error) {
        res.status(500).json({ success: false, message: "Duyuru oluşturulamadı" });
    }
};

exports.updateAnnouncement = async (req, res) => {
    try {
        const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!announcement) return res.status(404).json({ success: false, message: "Duyuru bulunamadı" });
        res.json({ success: true, announcement });
    } catch (error) {
        res.status(500).json({ success: false, message: "Duyuru güncellenemedi" });
    }
};

exports.deleteAnnouncement = async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Duyuru silindi" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Duyuru silinemedi" });
    }
};

/* ═══════════════════════════════════════════════════════════
   9. AUDIT LOG & İZLEME
   ═══════════════════════════════════════════════════════════ */
exports.getAuditLogs = async (req, res) => {
    try {
        const { category, severity, limit: lim } = req.query;
        const filter = {};
        if (category && category !== "all") filter.category = category;
        if (severity && severity !== "all") filter.severity = severity;

        const logs = await AuditLog.find(filter)
            .populate("userId", "name email")
            .populate("adminId", "name email")
            .sort({ createdAt: -1 })
            .limit(parseInt(lim) || 200);

        res.json({ success: true, logs });
    } catch (error) {
        res.status(500).json({ success: false, message: "Audit logları alınamadı" });
    }
};

/* ═══════════════════════════════════════════════════════════
   10. DESTEK / TİCKET SİSTEMİ
   ═══════════════════════════════════════════════════════════ */
exports.getTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find()
            .populate("userId", "name email")
            .populate("assignedTo", "name email")
            .sort({ createdAt: -1 });
        res.json({ success: true, tickets });
    } catch (error) {
        res.status(500).json({ success: false, message: "Ticketlar alınamadı" });
    }
};

exports.getTicketDetail = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id)
            .populate("userId", "name email")
            .populate("assignedTo", "name email")
            .populate("messages.sender", "name email");
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket bulunamadı" });
        res.json({ success: true, ticket });
    } catch (error) {
        res.status(500).json({ success: false, message: "Ticket detayı alınamadı" });
    }
};

exports.replyTicket = async (req, res) => {
    try {
        const { message } = req.body;
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket bulunamadı" });

        ticket.messages.push({
            sender: req.user._id,
            senderType: "admin",
            message,
            timestamp: new Date(),
        });

        if (ticket.status === "open") ticket.status = "in_progress";
        ticket.assignedTo = req.user._id;
        await ticket.save();

        await AuditLog.create({
            userId: ticket.userId,
            adminId: req.user._id,
            action: "ticket_replied",
            category: "system",
            severity: "info",
            description: `Ticket yanıtlandı: #${ticket.ticketNumber}`,
            ipAddress: req.ip,
        });

        res.json({ success: true, ticket });
    } catch (error) {
        res.status(500).json({ success: false, message: "Yanıt gönderilemedi" });
    }
};

exports.updateTicketStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket bulunamadı" });

        ticket.status = status;
        if (status === "resolved") ticket.resolvedAt = new Date();
        if (status === "closed") ticket.closedAt = new Date();
        await ticket.save();

        res.json({ success: true, ticket });
    } catch (error) {
        res.status(500).json({ success: false, message: "Ticket durumu güncellenemedi" });
    }
};

/* ═══════════════════════════════════════════════════════════
   11. SİSTEM AYARLARI
   ═══════════════════════════════════════════════════════════ */
exports.getSystemConfig = async (req, res) => {
    try {
        const fs = require("fs");
        const path = require("path");

        // Paket tanımları — DB'den oku (yoksa default)
        const planDefinitions = await getPlanDefinitions();

        // Sistem bilgileri
        const systemInfo = {
            nodeVersion: process.version,
            environment: process.env.NODE_ENV || "development",
            hostname: os.hostname(),
            platform: `${os.platform()} ${os.arch()}`,
            pid: process.pid,
            dbHost: mongoose.connection.host || "-",
            dbName: mongoose.connection.name || "-",
            dbConnected: mongoose.connection.readyState === 1,
            uptime: Math.floor(process.uptime()),
        };

        res.json({
            success: true,
            planDefinitions,
            systemInfo,
            features: {
                pwa: true,
                responsive: true,
                aiPanel: true,
                marketplace: true,
                finance: true,
                cargo: true,
                tickets: true,
                announcements: true,
            },
            limits: {
                maxUploadSize: "10MB",
                apiRateLimit: "100/min",
                sessionTimeout: "24h",
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Sistem ayarları alınamadı" });
    }
};

/* ═══════════════════════════════════════════════════════════
   12. PAKET TANIMLARI GÜNCELLEME (Plan Definitions)
   ═══════════════════════════════════════════════════════════ */

/**
 * Paket tanımlarını güncelle — fiyat, limit, süre vb.
 * Body: { planDefinitions: { trial: {...}, basic: {...}, pro: {...}, enterprise: {...} } }
 *
 * Paket tanımları MongoDB'de SystemConfig koleksiyonunda saklanır.
 * Yoksa default değerler kullanılır ve ilk güncelleme ile oluşturulur.
 */
const SystemConfig = require("../../models/SystemConfig");
const { invalidatePlansCache } = require("../paytrController");

const DEFAULT_PLAN_DEFINITIONS = {
    trial: {
        name: "Deneme",
        description: "Platformu keşfetmek için ücretsiz deneme paketi",
        badge: "",
        price: 0,
        monthlyPrice: 0,
        yearlyPrice: 0,
        duration: 14,
        limits: { maxProducts: 50, maxOrders: 100, maxMarketplaces: 1, maxApiCalls: 5000, maxUsers: 1 },
        features: ["Dashboard erişimi", "50 ürün yönetimi", "100 sipariş/ay", "1 pazaryeri entegrasyonu", "Temel raporlama"],
    },
    basic: {
        name: "Basic",
        description: "Küçük işletmeler için temel e-ticaret yönetimi",
        badge: "",
        price: 299,
        monthlyPrice: 299,
        yearlyPrice: 2990,
        duration: 30,
        limits: { maxProducts: 500, maxOrders: 5000, maxMarketplaces: 3, maxApiCalls: 50000, maxUsers: 3 },
        features: ["Dashboard erişimi", "500 ürün yönetimi", "5.000 sipariş/ay", "3 pazaryeri entegrasyonu", "Gelişmiş raporlama", "Kargo takibi", "E-posta desteği"],
    },
    pro: {
        name: "Pro",
        description: "Büyüyen işletmeler için gelişmiş özellikler ve AI desteği",
        badge: "EN POPÜLER",
        price: 799,
        monthlyPrice: 799,
        yearlyPrice: 7990,
        duration: 30,
        limits: { maxProducts: 5000, maxOrders: 50000, maxMarketplaces: 10, maxApiCalls: 500000, maxUsers: 10 },
        features: ["Tüm Basic özellikleri", "5.000 ürün yönetimi", "50.000 sipariş/ay", "10 pazaryeri entegrasyonu", "AI Asistan & Radar", "Otomatik sipariş", "E-fatura entegrasyonu", "Öncelikli destek", "Gelişmiş analitik"],
    },
    enterprise: {
        name: "Enterprise",
        description: "Büyük ölçekli operasyonlar için sınırsız erişim ve özel destek",
        badge: "ÖZEL",
        price: 1999,
        monthlyPrice: 1999,
        yearlyPrice: 19990,
        duration: 30,
        limits: { maxProducts: 999999, maxOrders: 999999, maxMarketplaces: 999, maxApiCalls: 9999999, maxUsers: 999 },
        features: ["Tüm Pro özellikleri", "Sınırsız ürün", "Sınırsız sipariş", "Sınırsız pazaryeri", "Sınırsız kullanıcı", "Özel API erişimi", "Dedicated destek", "SLA garantisi", "Özel entegrasyonlar", "White-label seçeneği"],
    },
};

// Paket tanımlarını DB'den oku (yoksa default)
const getPlanDefinitions = async () => {
    try {
        const doc = await SystemConfig.findOne({ key: "planDefinitions" }).lean();
        return doc?.value || DEFAULT_PLAN_DEFINITIONS;
    } catch {
        return DEFAULT_PLAN_DEFINITIONS;
    }
};

exports.updatePlanDefinitions = async (req, res) => {
    try {
        const { planDefinitions } = req.body;
        if (!planDefinitions || typeof planDefinitions !== "object") {
            return res.status(400).json({ success: false, message: "planDefinitions objesi gerekli" });
        }

        // Validasyon — her plan için gerekli alanlar
        for (const [key, plan] of Object.entries(planDefinitions)) {
            if (!plan.name) return res.status(400).json({ success: false, message: `${key}: name gerekli` });
            if (plan.price === undefined || plan.price === null) return res.status(400).json({ success: false, message: `${key}: price gerekli` });
            if (!plan.limits) return res.status(400).json({ success: false, message: `${key}: limits gerekli` });

            // monthlyPrice yoksa price'tan türet, yearlyPrice yoksa monthlyPrice * 10
            if (!plan.monthlyPrice && plan.monthlyPrice !== 0) plan.monthlyPrice = plan.price;
            if (!plan.yearlyPrice && plan.yearlyPrice !== 0) plan.yearlyPrice = Math.round(plan.monthlyPrice * 10);
            if (!plan.description) plan.description = "";
            if (!plan.badge) plan.badge = "";
            if (!Array.isArray(plan.features)) plan.features = [];
        }

        await SystemConfig.findOneAndUpdate(
            { key: "planDefinitions" },
            { value: planDefinitions, updatedBy: req.user._id, updatedAt: new Date() },
            { upsert: true, new: true }
        );

        // PayTR controller'daki plan cache'ini temizle — değişiklikler anında yansısın
        invalidatePlansCache();

        await AuditLog.create({
            adminId: req.user._id,
            action: "plan_definitions_updated",
            category: "system",
            severity: "warning",
            description: `Paket tanımları güncellendi: ${Object.keys(planDefinitions).join(", ")}`,
            metadata: planDefinitions,
            ipAddress: req.ip,
        });

        res.json({ success: true, message: "Paket tanımları güncellendi", planDefinitions });
    } catch (error) {
        logger.error(`Paket tanımları güncelleme hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Paket tanımları güncellenemedi" });
    }
};

/* ═══════════════════════════════════════════════════════════
   13. PUBLIC PAKET BİLGİLERİ (Auth gerektirmez — HomePage & SubscriptionPage)
   ═══════════════════════════════════════════════════════════ */
exports.getPublicPlans = async (req, res) => {
    try {
        const plans = await getPlanDefinitions();
        // Public'e sadece gerekli bilgileri gönder (admin-only alanları hariç)
        const publicPlans = {};
        for (const [key, plan] of Object.entries(plans)) {
            publicPlans[key] = {
                name: plan.name,
                description: plan.description || "",
                badge: plan.badge || "",
                price: plan.price || 0,
                monthlyPrice: plan.monthlyPrice || plan.price || 0,
                yearlyPrice: plan.yearlyPrice || Math.round((plan.monthlyPrice || plan.price || 0) * 10),
                duration: plan.duration || (key === "trial" ? 14 : 30),
                limits: plan.limits || {},
                features: plan.features || [],
            };
        }
        res.json({ success: true, plans: publicPlans });
    } catch (error) {
        logger.error(`Public plan bilgileri hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Paket bilgileri alınamadı" });
    }
};

/* ═══════════════════════════════════════════════════════════
   13. KULLANICI ROL DEĞİŞTİRME
   ═══════════════════════════════════════════════════════════ */
exports.updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        const validRoles = ["user", "seller", "moderator", "dev", "admin"];

        if (!role || !validRoles.includes(role)) {
            return res.status(400).json({ success: false, message: `Geçersiz rol. Geçerli roller: ${validRoles.join(", ")}` });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

        const oldRole = user.role;
        user.role = role;
        await user.save();

        await AuditLog.create({
            userId: id,
            adminId: req.user._id,
            action: "user_role_changed",
            category: "user",
            severity: role === "admin" ? "critical" : "warning",
            description: `Kullanıcı rolü değiştirildi: ${user.name} (${user.email}) — ${oldRole} → ${role}`,
            metadata: { oldRole, newRole: role },
            ipAddress: req.ip,
        });

        res.json({ success: true, message: `Rol güncellendi: ${oldRole} → ${role}`, user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        logger.error(`Rol değiştirme hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Rol değiştirilemedi" });
    }
};

/* ═══════════════════════════════════════════════════════════
   14. KULLANICI SİLME
   ═══════════════════════════════════════════════════════════ */
exports.deleteTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

        // Admin kendini silemez
        if (id === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: "Kendi hesabınızı silemezsiniz" });
        }

        // İlişkili verileri temizle
        const [delSubs, delMps, delOrders, delProducts] = await Promise.all([
            Subscription.deleteMany({ userId: id }),
            Marketplace.deleteMany({ userId: id }),
            Order.deleteMany({ user: id }),
            ProductMapping.deleteMany({ userId: id }),
        ]);

        await User.findByIdAndDelete(id);

        await AuditLog.create({
            adminId: req.user._id,
            action: "tenant_deleted",
            category: "security",
            severity: "critical",
            description: `Kullanıcı silindi: ${user.name} (${user.email}). Silinen: ${delSubs.deletedCount} abonelik, ${delMps.deletedCount} entegrasyon, ${delOrders.deletedCount} sipariş, ${delProducts.deletedCount} ürün`,
            ipAddress: req.ip,
        });

        res.json({
            success: true,
            message: `${user.name} ve tüm verileri silindi`,
            deleted: { subscriptions: delSubs.deletedCount, marketplaces: delMps.deletedCount, orders: delOrders.deletedCount, products: delProducts.deletedCount }
        });
    } catch (error) {
        logger.error(`Kullanıcı silme hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Kullanıcı silinemedi" });
    }
};

/* ═══════════════════════════════════════════════════════════
   15. KULLANICI PROFİL GÜNCELLEME (Admin tarafından)
   ═══════════════════════════════════════════════════════════ */
exports.updateTenantProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, company } = req.body;

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

        if (name) user.name = name;
        if (email) {
            // Email benzersizlik kontrolü
            const existing = await User.findOne({ email, _id: { $ne: id } });
            if (existing) return res.status(400).json({ success: false, message: "Bu email zaten kullanılıyor" });
            user.email = email;
        }
        if (!user.profile) user.profile = {};
        if (phone !== undefined) user.profile.phone = phone;
        if (company !== undefined) user.profile.company = company;
        user.markModified("profile");
        await user.save();

        await AuditLog.create({
            userId: id,
            adminId: req.user._id,
            action: "tenant_profile_updated",
            category: "user",
            severity: "info",
            description: `Kullanıcı profili güncellendi: ${user.name} (${user.email})`,
            ipAddress: req.ip,
        });

        res.json({ success: true, message: "Profil güncellendi", user: { _id: user._id, name: user.name, email: user.email, role: user.role, profile: user.profile } });
    } catch (error) {
        logger.error(`Profil güncelleme hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Profil güncellenemedi" });
    }
};

/* ═══════════════════════════════════════════════════════════
   16. ADMIN RESET PASSWORD
   ═══════════════════════════════════════════════════════════ */
exports.adminResetPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        const bcrypt = require("bcryptjs");

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

        const salt = await bcrypt.genSalt(10);
        // ✅ SEC: Hardcoded fallback şifre kaldırıldı — şifre zorunlu
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ success: false, message: "Yeni şifre en az 8 karakter olmalıdır" });
        }
        if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            return res.status(400).json({ success: false, message: "Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir" });
        }
        user.password = await bcrypt.hash(newPassword, salt);
        if (!user.security) user.security = {};
        user.security.lastPasswordChange = new Date();
        await user.save();

        await AuditLog.create({
            userId: id,
            adminId: req.user._id,
            action: "admin_password_reset",
            category: "security",
            severity: "warning",
            description: `Admin tarafından şifre sıfırlandı: ${user.name} (${user.email})`,
            ipAddress: req.ip,
        });

        res.json({ success: true, message: "Şifre sıfırlandı" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Şifre sıfırlanamadı" });
    }
};
