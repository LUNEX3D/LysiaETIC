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
        const trialUsers = await User.countDocuments({ "subscription.plan": "free" });

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
        const user = await User.findById(req.params.id).select("-password");
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

        const [marketplaces, products, orders, subscription, payments, tickets] = await Promise.all([
            Marketplace.find({ userId: user._id }),
            ProductMapping.countDocuments({ userId: user._id }),
            Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(20),
            Subscription.findOne({ userId: user._id }).sort({ createdAt: -1 }),
            Payment.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10),
            Ticket.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10),
        ]);

        const orderRevenue = await Order.aggregate([
            { $match: { user: user._id } },
            { $group: { _id: null, total: { $sum: "$totalPrice" }, count: { $sum: 1 } } }
        ]);

        res.json({
            success: true,
            tenant: user.toObject(),
            marketplaces,
            productCount: products,
            recentOrders: orders,
            orderStats: { total: orderRevenue[0]?.count || 0, revenue: orderRevenue[0]?.total || 0 },
            subscription: subscription || null,
            payments,
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
   ═══════════════════════════════════════════════════════════ */
exports.getSubscriptions = async (req, res) => {
    try {
        const subs = await Subscription.find()
            .populate("userId", "name email role")
            .sort({ createdAt: -1 });
        res.json({ success: true, subscriptions: subs });
    } catch (error) {
        res.status(500).json({ success: false, message: "Abonelikler alınamadı" });
    }
};

exports.updateSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const sub = await Subscription.findByIdAndUpdate(id, updates, { new: true });
        if (!sub) return res.status(404).json({ success: false, message: "Abonelik bulunamadı" });

        // Kullanıcının plan bilgisini de güncelle
        if (updates.plan) {
            await User.findByIdAndUpdate(sub.userId, {
                "subscription.plan": updates.plan,
                "subscription.status": updates.status || sub.status,
            });
        }

        await AuditLog.create({
            userId: sub.userId,
            adminId: req.user._id,
            action: "subscription_updated",
            category: "subscription",
            severity: "info",
            description: `Abonelik güncellendi: Plan=${updates.plan || sub.plan}, Durum=${updates.status || sub.status}`,
            metadata: updates,
            ipAddress: req.ip,
        });

        res.json({ success: true, subscription: sub });
    } catch (error) {
        res.status(500).json({ success: false, message: "Abonelik güncellenemedi" });
    }
};

exports.createSubscription = async (req, res) => {
    try {
        const { userId, plan, status, startDate, endDate, limits, price, billingCycle } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

        // Mevcut aktif aboneliği iptal et
        await Subscription.updateMany(
            { userId, status: { $in: ["active", "trial"] } },
            { $set: { status: "cancelled", cancelledAt: new Date() } }
        );

        const defaultLimits = {
            trial: { maxProducts: 50, maxOrders: 100, maxMarketplaces: 1, maxApiCalls: 5000, maxUsers: 1 },
            basic: { maxProducts: 500, maxOrders: 5000, maxMarketplaces: 3, maxApiCalls: 50000, maxUsers: 3 },
            pro: { maxProducts: 5000, maxOrders: 50000, maxMarketplaces: 10, maxApiCalls: 500000, maxUsers: 10 },
            enterprise: { maxProducts: 999999, maxOrders: 999999, maxMarketplaces: 999, maxApiCalls: 9999999, maxUsers: 999 },
        };

        const sub = await Subscription.create({
            userId,
            plan: plan || "trial",
            status: status || "active",
            startDate: startDate || new Date(),
            endDate: endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            limits: limits || defaultLimits[plan] || defaultLimits.trial,
            price: price || 0,
            billingCycle: billingCycle || "monthly",
        });

        // Kullanıcı modelini güncelle
        user.subscription = { plan: sub.plan, status: sub.status, startDate: sub.startDate, endDate: sub.endDate };
        user.markModified("subscription");
        await user.save();

        await AuditLog.create({
            userId,
            adminId: req.user._id,
            action: "subscription_created",
            category: "subscription",
            severity: "info",
            description: `Yeni abonelik oluşturuldu: ${user.name} → ${plan}`,
            ipAddress: req.ip,
        });

        res.json({ success: true, subscription: sub });
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

        // Paket tanımları
        const planDefinitions = {
            trial: { name: "Trial", price: 0, duration: 14, limits: { maxProducts: 50, maxOrders: 100, maxMarketplaces: 1, maxApiCalls: 5000, maxUsers: 1 } },
            basic: { name: "Basic", price: 299, duration: 30, limits: { maxProducts: 500, maxOrders: 5000, maxMarketplaces: 3, maxApiCalls: 50000, maxUsers: 3 } },
            pro: { name: "Pro", price: 799, duration: 30, limits: { maxProducts: 5000, maxOrders: 50000, maxMarketplaces: 10, maxApiCalls: 500000, maxUsers: 10 } },
            enterprise: { name: "Enterprise", price: 1999, duration: 30, limits: { maxProducts: 999999, maxOrders: 999999, maxMarketplaces: 999, maxApiCalls: 9999999, maxUsers: 999 } },
        };

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
   12. ADMIN RESET PASSWORD
   ═══════════════════════════════════════════════════════════ */
exports.adminResetPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        const bcrypt = require("bcryptjs");

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword || "LysiaETIC2024!", salt);
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
