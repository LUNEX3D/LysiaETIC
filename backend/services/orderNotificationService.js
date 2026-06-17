/**
 * orderNotificationService.js — Yeni sipariş e-posta bildirimi
 *
 * Pazaryerinden (Trendyol, N11, Hepsiburada, ÇiçekSepeti, Amazon...) yeni bir sipariş
 * sisteme ilk kez kaydedildiğinde, kullanıcının kayıtlı e-posta adresine ürün/sipariş
 * detayı + platform bilgisi içeren şık bir bilgilendirme maili gönderir.
 *
 * Güvenceler:
 *   - Tercih kontrolü: settings.orderNotifications ve settings.notifications.email
 *   - Idempotent: Order.newOrderEmailSentAt "claim-first" ile çift mail engellenir
 *   - Flood koruması: yalnızca son N gün içindeki + iptal/iade olmayan siparişler,
 *     tek sync turunda en fazla MAX_PER_RUN adet
 */

const Order = require("../models/Order");
const User = require("../models/User");
const Notification = require("../models/Notification");
const logger = require("../config/logger");
const { sendNewOrderEmail } = require("./emailService");
const { collectOrderMatchClauses } = require("../utils/orderMatchKeys");
const { normalizeMarketplaceName } = require("../models/Marketplace");

const RETRY_EMAIL_ON_FAIL =
    String(process.env.NEW_ORDER_EMAIL_RETRY_ON_FAIL || "false").toLowerCase() === "true";

/** Aynı iş siparişi için daha önce mail gönderilmiş kayıt var mı? */
const findPriorEmailSentOrder = async (userId, order) => {
    const mp = normalizeMarketplaceName(order.marketplaceName || "");
    const mpLower = mp.toLowerCase();
    const isHb = mpLower.includes("hepsi");
    const isCs = /cicek|çiçek/i.test(mp);

    const or = collectOrderMatchClauses(order, {
        orderNumber: order.trackingNumber,
        tracking: order.trackingNumber,
        isHepsiburada: isHb,
        isCiceksepeti: isCs,
    });
    if (!or.length) return null;

    return Order.findOne({
        user: userId,
        marketplaceName: mp,
        newOrderEmailSentAt: { $exists: true },
        $or: or,
    })
        .select("_id newOrderEmailSentAt trackingNumber")
        .sort({ newOrderEmailSentAt: -1 })
        .lean();
};

const markEmailSentInherited = async (orderId, sentAt) => {
    if (!orderId || !sentAt) return;
    await Order.updateOne(
        { _id: orderId, newOrderEmailSentAt: { $exists: false } },
        { $set: { newOrderEmailSentAt: sentAt } }
    ).catch(() => {});
};

const ENABLED = String(process.env.NEW_ORDER_EMAIL_ENABLED || "true").toLowerCase() !== "false";
const MAX_AGE_DAYS = parseInt(process.env.NEW_ORDER_EMAIL_MAX_AGE_DAYS || "3", 10);
const MAX_PER_RUN = parseInt(process.env.NEW_ORDER_EMAIL_MAX_PER_RUN || "25", 10);

const displayMp = (name = "") => {
    const k = String(name || "").toLowerCase().trim();
    if (k === "trendyol") return "Trendyol";
    if (k === "hepsiburada") return "Hepsiburada";
    if (k === "n11") return "N11";
    if (k === "çiçeksepeti" || k === "ciceksepeti") return "ÇiçekSepeti";
    if (k === "amazon") return "Amazon";
    return String(name || "").trim() || "Pazaryeri";
};

const readNotificationPrefs = (user) => {
    const p = user?.preferences || user?.settings || {};
    return {
        orderOn: p.orderNotifications !== false,
        emailOn: !p.notifications || p.notifications.email !== false,
    };
};

/**
 * Yeni kaydedilen siparişler için bildirim e-postası gönderir.
 * @param {string|ObjectId} userId
 * @param {Array<string|ObjectId>} orderIds - syncOrdersBackground'da yeni kaydedilen sipariş id'leri
 */
const notifyNewOrders = async (userId, orderIds) => {
    try {
        if (!ENABLED) return { sent: 0, skipped: 0, reason: "disabled" };
        if (!userId || !Array.isArray(orderIds) || orderIds.length === 0) {
            return { sent: 0, skipped: 0 };
        }

        const user = await User.findById(userId).select("name email preferences").lean();
        if (!user || !user.email) return { sent: 0, skipped: 0, reason: "no_user_email" };

        const { orderOn, emailOn } = readNotificationPrefs(user);
        if (!orderOn || !emailOn) {
            return { sent: 0, skipped: orderIds.length, reason: "pref_off" };
        }

        const minDate = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

        // Aday siparişler: bu kullanıcıya ait, henüz mail gönderilmemiş, iptal/iade değil,
        // ve makul güncellikte (eski toplu içe aktarımlarda mail seli olmasın)
        const candidates = await Order.find({
            _id: { $in: orderIds },
            user: userId,
            newOrderEmailSentAt: { $exists: false },
            isCancelled: { $ne: true },
            isReturned: { $ne: true },
            orderDate: { $gte: minDate },
        })
            .sort({ orderDate: -1 })
            .lean();

        if (candidates.length === 0) return { sent: 0, skipped: 0 };

        let sent = 0;
        let skipped = 0;
        const batch = candidates.slice(0, MAX_PER_RUN);

        for (const order of batch) {
            const prior = await findPriorEmailSentOrder(userId, order);
            if (prior) {
                await markEmailSentInherited(order._id, prior.newOrderEmailSentAt);
                skipped++;
                continue;
            }

            // Claim-first: aynı anda başka bir sync turu da göndermesin
            const claim = await Order.updateOne(
                { _id: order._id, newOrderEmailSentAt: { $exists: false } },
                { $set: { newOrderEmailSentAt: new Date() } }
            );
            if (!claim || claim.modifiedCount === 0) {
                skipped++;
                continue;
            }

            const res = await sendNewOrderEmail(user, { order });
            if (res && res.success) {
                sent++;
            } else {
                skipped++;
                logger.warn(
                    `[OrderNotify] E-posta gönderilemedi (sipariş ${order.trackingNumber || order._id}): ${res?.error || "bilinmeyen"}`
                );
                // Varsayılan: bayrağı geri alma — cron her turda aynı maili tekrar göndermesin
                if (RETRY_EMAIL_ON_FAIL) {
                    await Order.updateOne(
                        { _id: order._id },
                        { $unset: { newOrderEmailSentAt: "" } }
                    ).catch(() => {});
                }
            }
        }

        if (candidates.length > batch.length) {
            logger.warn(
                `[OrderNotify] ${candidates.length} yeni sipariş için bildirim adayı vardı, ` +
                `flood koruması: ilk ${batch.length} tanesi işlendi`
            );
        }
        if (sent > 0) {
            logger.info(`[OrderNotify] ${sent} yeni sipariş e-postası gönderildi → ${user.email}`);
        }
        return { sent, skipped };
    } catch (err) {
        logger.warn(`[OrderNotify] Yeni sipariş bildirimi hatası: ${err.message}`);
        return { sent: 0, skipped: 0, error: err.message };
    }
};

/**
 * Yeni kaydedilen siparişler için uygulama içi bildirim oluşturur (cron / sync sonrası).
 */
const createInAppOrderNotifications = async (userId, orderIds) => {
    try {
        if (!userId || !Array.isArray(orderIds) || orderIds.length === 0) {
            return { created: 0 };
        }

        const user = await User.findById(userId).select("preferences").lean();
        const { orderOn } = readNotificationPrefs(user);
        if (!orderOn) return { created: 0, reason: "pref_off" };

        const orders = await Order.find({ _id: { $in: orderIds }, user: userId })
            .select(
                "trackingNumber marketplaceName totalPrice status orderDate customerName items isCancelled isReturned"
            )
            .lean();
        if (!orders.length) return { created: 0 };

        const active = orders.filter((o) => !o.isCancelled && !o.isReturned);
        if (!active.length) return { created: 0 };

        const orderNumbers = active.map((o) => String(o.trackingNumber || "").trim()).filter(Boolean);
        const existing = await Notification.find({
            userId,
            type: "order",
            "orderData.orderNumber": { $in: orderNumbers },
        })
            .select("orderData.orderNumber orderData.marketplace")
            .lean();

        const existingSet = new Set(
            existing.map((n) => `${String(n.orderData?.marketplace || "").toLowerCase()}|${n.orderData?.orderNumber}`)
        );

        const newNotifs = active
            .filter((o) => {
                const no = String(o.trackingNumber || "").trim();
                if (!no) return false;
                const key = `${String(o.marketplaceName || "").toLowerCase()}|${no}`;
                return !existingSet.has(key);
            })
            .map((o) => {
                const mp = displayMp(o.marketplaceName);
                const no = String(o.trackingNumber || "").trim();
                const price = Number(o.totalPrice || 0);
                return {
                    userId,
                    type: "order",
                    priority: "high",
                    title: "🛒 Yeni Sipariş!",
                    message: `${mp} — #${no} — ${price ? price.toLocaleString("tr-TR") + " ₺" : ""}`,
                    icon: "🛒",
                    orderData: {
                        orderNumber: no,
                        marketplace: mp,
                        totalPrice: price,
                        itemCount: Array.isArray(o.items) ? o.items.length : 1,
                        customerName: o.customerName || "",
                        status: o.status || "Created",
                        orderDate: o.orderDate ? new Date(o.orderDate) : new Date(),
                    },
                    actionLink: "orders",
                };
            });

        if (newNotifs.length > 0) {
            await Notification.insertMany(newNotifs);
            logger.info(`[OrderNotify] ${newNotifs.length} uygulama içi sipariş bildirimi → userId=${userId}`);
        }
        return { created: newNotifs.length };
    } catch (err) {
        logger.warn(`[OrderNotify] Uygulama içi bildirim hatası: ${err.message}`);
        return { created: 0, error: err.message };
    }
};

/** E-posta + uygulama içi bildirim — sync sonrası tek giriş */
const handleNewOrderNotifications = async (userId, orderIds) => {
    const [emailRes, inAppRes] = await Promise.all([
        notifyNewOrders(userId, orderIds),
        createInAppOrderNotifications(userId, orderIds),
    ]);
    return { email: emailRes, inApp: inAppRes };
};

module.exports = {
    notifyNewOrders,
    createInAppOrderNotifications,
    handleNewOrderNotifications,
    findPriorEmailSentOrder,
    markEmailSentInherited,
};
