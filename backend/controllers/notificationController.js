/**
 * Notification Controller — LysiaETIC
 *
 * Birleşik bildirim sistemi:
 *   • Kullanıcı bildirimleri (sipariş, stok, AI)
 *   • Admin broadcast bildirimleri
 *   • Okundu/silindi işaretleme
 *   • Polling desteği (lastCheck ile sadece yeni bildirimleri çek)
 */
const Notification = require("../models/Notification");
const User = require("../models/User");
const logger = require("../config/logger");
const mongoose = require("mongoose");

const toOid = (v) => {
    try { return new mongoose.Types.ObjectId(v); } catch { return null; }
};

/** [start, end) UTC anları — Europe/Istanbul yerel günü */
const getTodayBoundsIstanbul = () => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now);
    const y = parts.find((p) => p.type === "year").value;
    const mo = parts.find((p) => p.type === "month").value;
    const d = parts.find((p) => p.type === "day").value;
    const start = new Date(`${y}-${mo}-${d}T00:00:00+03:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
};

/** Sipariş bildirimleri: sadece İstanbul’daki bugünkü siparişler çanda / sayaçta görünsün */
const orderNotifDayClause = () => {
    const { start, end } = getTodayBoundsIstanbul();
    return {
        $or: [
            { type: { $ne: "order" } },
            { type: "order", "orderData.orderDate": { $gte: start, $lt: end } },
        ],
    };
};

const isOrderDateTodayIstanbul = (orderDate) => {
    if (!orderDate) return false;
    const t = new Date(orderDate);
    if (Number.isNaN(t.getTime())) return false;
    const { start, end } = getTodayBoundsIstanbul();
    return t >= start && t < end;
};

// ═══════════════════════════════════════════════════════════════
// 📥 BİLDİRİMLERİ GETİR (Kullanıcı)
// GET /notifications
// Query: ?lastCheck=ISO_DATE&type=order,admin,ai&limit=50
// ═══════════════════════════════════════════════════════════════
exports.getNotifications = async (req, res) => {
    try {
        const userId = toOid(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { lastCheck, type, limit = 50 } = req.query;

        // Kullanıcıya özel + broadcast bildirimler (+ sipariş tipi yalnızca bugün İstanbul günü)
        const filter = {
            isActive: true,
            dismissedBy: { $ne: userId },
            $and: [
                {
                    $or: [
                        { userId: userId },
                        { userId: null, "adminData.targetAudience": "all" },
                        { userId: null, type: "system" },
                    ],
                },
                orderNotifDayClause(),
            ],
        };

        if (lastCheck) {
            filter.$and.push({ createdAt: { $gt: new Date(lastCheck) } });
        }

        if (type) {
            const types = type.split(",").map(t => t.trim()).filter(Boolean);
            if (types.length > 0) filter.$and.push({ type: { $in: types } });
        }

        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(limit), 100))
            .lean();

        // Her bildirim için okunma durumunu hesapla
        const enriched = notifications.map(n => {
            let isRead = false;
            if (n.userId) {
                // Kişisel bildirim
                isRead = n.isRead === true;
            } else {
                // Broadcast bildirim — readBy array'inde mi?
                isRead = (n.readBy || []).some(r => r.userId?.toString() === userId.toString());
            }
            return { ...n, isRead, readBy: undefined }; // readBy array'ini client'a gönderme
        });

        // Okunmamış sayıları hesapla (sipariş: yalnızca bugünkü kayıtlar)
        const unreadFilter = {
            isActive: true,
            dismissedBy: { $ne: userId },
            $and: [
                {
                    $or: [
                        { userId: userId, isRead: false },
                        {
                            userId: null,
                            "adminData.targetAudience": "all",
                            "readBy.userId": { $ne: userId },
                        },
                        {
                            userId: null,
                            type: "system",
                            "readBy.userId": { $ne: userId },
                        },
                    ],
                },
                orderNotifDayClause(),
            ],
        };

        const allUnread = await Notification.find(unreadFilter).select("type").lean();
        const counts = {
            total: allUnread.length,
            order: allUnread.filter(n => n.type === "order").length,
            admin: allUnread.filter(n => n.type === "admin").length,
            ai: allUnread.filter(n => n.type === "ai").length,
            stock: allUnread.filter(n => n.type === "stock").length,
            system: allUnread.filter(n => n.type === "system").length
        };

        return res.json({
            success: true,
            notifications: enriched,
            counts,
            serverTime: new Date().toISOString()
        });

    } catch (error) {
        logger.error("[NOTIF:GET] Hata:", error.message);
        return res.status(500).json({ error: "Bildirimler alınamadı", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// ✅ OKUNDU İŞARETLE
// PUT /notifications/:id/read
// PUT /notifications/read-all
// ═══════════════════════════════════════════════════════════════
exports.markAsRead = async (req, res) => {
    try {
        const userId = toOid(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { id } = req.params;

        if (id === "all") {
            // Kişisel bildirimleri okundu yap
            await Notification.updateMany(
                { userId: userId, isRead: false },
                { $set: { isRead: true, readAt: new Date() } }
            );

            // Broadcast bildirimleri readBy'a ekle
            await Notification.updateMany(
                {
                    userId: null,
                    isActive: true,
                    "readBy.userId": { $ne: userId },
                    dismissedBy: { $ne: userId }
                },
                { $addToSet: { readBy: { userId, readAt: new Date() } } }
            );

            return res.json({ success: true, message: "Tüm bildirimler okundu" });
        }

        const notif = await Notification.findById(id);
        if (!notif) return res.status(404).json({ error: "Bildirim bulunamadı" });

        if (notif.userId) {
            // Kişisel bildirim
            if (notif.userId.toString() !== userId.toString()) {
                return res.status(403).json({ error: "Bu bildirime erişim yetkiniz yok" });
            }
            notif.isRead = true;
            notif.readAt = new Date();
            await notif.save();
        } else {
            // Broadcast bildirim
            const alreadyRead = (notif.readBy || []).some(r => r.userId?.toString() === userId.toString());
            if (!alreadyRead) {
                notif.readBy.push({ userId, readAt: new Date() });
                await notif.save();
            }
        }

        return res.json({ success: true, message: "Bildirim okundu" });

    } catch (error) {
        logger.error("[NOTIF:READ] Hata:", error.message);
        return res.status(500).json({ error: "İşlem başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🗑️ BİLDİRİM SİL (Dismiss)
// DELETE /notifications/:id
// ═══════════════════════════════════════════════════════════════
exports.dismissNotification = async (req, res) => {
    try {
        const userId = toOid(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { id } = req.params;

        if (id === "all") {
            // Kişisel bildirimleri sil
            await Notification.deleteMany({ userId: userId });

            // Broadcast bildirimleri dismiss et
            await Notification.updateMany(
                { userId: null, isActive: true },
                { $addToSet: { dismissedBy: userId } }
            );

            return res.json({ success: true, message: "Tüm bildirimler temizlendi" });
        }

        const notif = await Notification.findById(id);
        if (!notif) return res.status(404).json({ error: "Bildirim bulunamadı" });

        if (notif.userId) {
            // Kişisel bildirim — tamamen sil
            if (notif.userId.toString() !== userId.toString()) {
                return res.status(403).json({ error: "Bu bildirime erişim yetkiniz yok" });
            }
            await Notification.findByIdAndDelete(id);
        } else {
            // Broadcast — dismissedBy'a ekle
            await Notification.findByIdAndUpdate(id, { $addToSet: { dismissedBy: userId } });
        }

        return res.json({ success: true, message: "Bildirim silindi" });

    } catch (error) {
        logger.error("[NOTIF:DISMISS] Hata:", error.message);
        return res.status(500).json({ error: "İşlem başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📦 SİPARİŞ BİLDİRİMİ OLUŞTUR (Dahili — diğer servislerden çağrılır)
// POST /notifications/order  (veya servis fonksiyonu olarak)
// ═══════════════════════════════════════════════════════════════
exports.createOrderNotification = async (req, res) => {
    try {
        const userId = toOid(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { orderNumber, marketplace, totalPrice, itemCount, customerName, status, orderDate } = req.body;

        if (!orderNumber || !marketplace) {
            return res.status(400).json({ error: "orderNumber ve marketplace zorunlu" });
        }

        if (!isOrderDateTodayIstanbul(orderDate)) {
            return res.json({ success: true, message: "Yalnızca bugünkü siparişler bildirim oluşturur", skipped: true });
        }

        // Aynı sipariş için tekrar bildirim oluşturma
        const exists = await Notification.findOne({
            userId,
            type: "order",
            "orderData.orderNumber": orderNumber,
            "orderData.marketplace": marketplace
        });
        if (exists) return res.json({ success: true, message: "Bildirim zaten mevcut", notification: exists });

        const notif = await Notification.create({
            userId,
            type: "order",
            priority: "high",
            title: "🛒 Yeni Sipariş!",
            message: `${marketplace} — #${orderNumber} — ${totalPrice ? Number(totalPrice).toLocaleString("tr-TR") + " ₺" : ""}`,
            icon: "🛒",
            orderData: { orderNumber, marketplace, totalPrice, itemCount, customerName, status, orderDate: new Date(orderDate) },
            actionLink: "orders"
        });

        return res.json({ success: true, notification: notif });

    } catch (error) {
        logger.error("[NOTIF:ORDER] Hata:", error.message);
        return res.status(500).json({ error: "Sipariş bildirimi oluşturulamadı", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📦 TOPLU SİPARİŞ BİLDİRİMİ (Dashboard polling'den çağrılır)
// POST /notifications/orders/bulk
// ═══════════════════════════════════════════════════════════════
exports.createBulkOrderNotifications = async (req, res) => {
    try {
        const userId = toOid(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { orders } = req.body; // [{ orderNumber, marketplace, totalPrice, itemCount, customerName, status }]
        if (!orders || !Array.isArray(orders) || orders.length === 0) {
            return res.json({ success: true, created: 0 });
        }

        // Mevcut sipariş bildirimlerini kontrol et
        const existingOrderNumbers = await Notification.find({
            userId,
            type: "order",
            "orderData.orderNumber": { $in: orders.map(o => o.orderNumber).filter(Boolean) }
        }).select("orderData.orderNumber").lean();

        const existingSet = new Set(existingOrderNumbers.map(n => n.orderData?.orderNumber));

        const newNotifs = orders
            .filter((o) => o.orderNumber && !existingSet.has(o.orderNumber))
            .filter((o) => isOrderDateTodayIstanbul(o.orderDate))
            .map((o) => ({
                userId,
                type: "order",
                priority: "high",
                title: "🛒 Yeni Sipariş!",
                message: `${o.marketplace || "Pazaryeri"} — #${o.orderNumber} — ${o.totalPrice ? Number(o.totalPrice).toLocaleString("tr-TR") + " ₺" : ""}`,
                icon: "🛒",
                orderData: {
                    orderNumber: o.orderNumber,
                    marketplace: o.marketplace,
                    totalPrice: o.totalPrice,
                    itemCount: o.itemCount,
                    customerName: o.customerName,
                    status: o.status,
                    orderDate: o.orderDate ? new Date(o.orderDate) : undefined,
                },
                actionLink: "orders"
            }));

        if (newNotifs.length > 0) {
            await Notification.insertMany(newNotifs);
        }

        return res.json({ success: true, created: newNotifs.length });

    } catch (error) {
        logger.error("[NOTIF:BULK_ORDER] Hata:", error.message);
        return res.status(500).json({ error: "Toplu sipariş bildirimi oluşturulamadı", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🛡️ ADMİN BİLDİRİMİ GÖNDER (Admin only)
// POST /notifications/admin/send
// ═══════════════════════════════════════════════════════════════
exports.sendAdminNotification = async (req, res) => {
    try {
        const adminId = toOid(req.user?._id || req.user?.id);
        if (!adminId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { title, message, priority, targetAudience, targetUserIds, targetPlan, expiresAt, icon } = req.body;

        if (!title || !message) {
            return res.status(400).json({ error: "title ve message zorunlu" });
        }

        const audience = targetAudience || "all";

        if (audience === "specific" && targetUserIds && Array.isArray(targetUserIds)) {
            // Belirli kullanıcılara gönder
            const notifs = targetUserIds.map(uid => ({
                userId: toOid(uid),
                type: "admin",
                priority: priority || "medium",
                title,
                message,
                icon: icon || "📢",
                adminData: {
                    sentBy: adminId,
                    targetAudience: "specific",
                    expiresAt: expiresAt ? new Date(expiresAt) : undefined
                },
                actionLink: null
            }));

            await Notification.insertMany(notifs.filter(n => n.userId));
            return res.json({ success: true, message: `${notifs.length} kullanıcıya bildirim gönderildi` });
        }

        // Broadcast bildirim (tüm kullanıcılara)
        const notif = await Notification.create({
            userId: null, // broadcast
            type: "admin",
            priority: priority || "medium",
            title,
            message,
            icon: icon || "📢",
            adminData: {
                sentBy: adminId,
                targetAudience: audience,
                targetPlan,
                expiresAt: expiresAt ? new Date(expiresAt) : undefined
            },
            actionLink: null
        });

        return res.json({ success: true, notification: notif, message: "Bildirim tüm kullanıcılara gönderildi" });

    } catch (error) {
        logger.error("[NOTIF:ADMIN] Hata:", error.message);
        return res.status(500).json({ error: "Admin bildirimi gönderilemedi", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🧠 AI BİLDİRİMİ OLUŞTUR (AI servislerinden çağrılır)
// POST /notifications/ai
// ═══════════════════════════════════════════════════════════════
exports.createAINotification = async (req, res) => {
    try {
        const userId = toOid(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { title, message, priority, category, actionRequired, relatedProductId, confidence, suggestedAction } = req.body;

        if (!title || !message) {
            return res.status(400).json({ error: "title ve message zorunlu" });
        }

        const notif = await Notification.create({
            userId,
            type: "ai",
            priority: priority || "medium",
            title,
            message,
            icon: category === "risk" ? "⚠️" : category === "opportunity" ? "💡" : category === "alert" ? "🚨" : "🧠",
            aiData: {
                category: category || "insight",
                actionRequired: actionRequired || false,
                relatedProductId: relatedProductId ? toOid(relatedProductId) : undefined,
                confidence,
                suggestedAction
            },
            actionLink: "advanced-ai"
        });

        return res.json({ success: true, notification: notif });

    } catch (error) {
        logger.error("[NOTIF:AI] Hata:", error.message);
        return res.status(500).json({ error: "AI bildirimi oluşturulamadı", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📊 ADMİN — TÜM BİLDİRİMLERİ GÖR
// GET /notifications/admin/all
// ═══════════════════════════════════════════════════════════════
exports.getAdminNotifications = async (req, res) => {
    try {
        const { type, limit = 50, page = 1 } = req.query;
        const filter = {};
        if (type) filter.type = type;

        const skip = (Number(page) - 1) * Number(limit);
        const [notifications, total] = await Promise.all([
            Notification.find(filter)
                .populate("userId", "name email")
                .populate("adminData.sentBy", "name email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Notification.countDocuments(filter)
        ]);

        return res.json({ success: true, notifications, total, page: Number(page), limit: Number(limit) });

    } catch (error) {
        logger.error("[NOTIF:ADMIN_ALL] Hata:", error.message);
        return res.status(500).json({ error: "Bildirimler alınamadı", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI — Servis fonksiyonu (controller dışından çağrılır)
// ═══════════════════════════════════════════════════════════════
exports.createNotificationDirect = async ({ userId, type, priority, title, message, icon, orderData, aiData, stockData, adminData, actionLink }) => {
    try {
        const notif = await Notification.create({
            userId: userId ? toOid(userId) : null,
            type,
            priority: priority || "medium",
            title,
            message,
            icon: icon || "🔔",
            orderData,
            aiData,
            stockData,
            adminData,
            actionLink
        });
        return notif;
    } catch (error) {
        logger.error("[NOTIF:DIRECT] Oluşturma hatası:", error.message);
        return null;
    }
};
