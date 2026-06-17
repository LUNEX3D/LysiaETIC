const { pickPreferredOrderRecord } = require("./orderStatus");
const { isHbInternalId } = require("../services/hepsiburadaService");

const normalizeMpKey = (name = "") =>
    String(name || "")
        .toLowerCase()
        .trim()
        .replace(/ç/g, "c")
        .replace(/ı/g, "i")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ö/g, "o");

const isCiceksepetiMp = (mpName = "") => /ciceksepeti/i.test(normalizeMpKey(mpName));

/**
 * Pazaryeri + sipariş için tekilleştirme anahtarı.
 * ÇiçekSepeti: orderItemId (trackingNumber) — parent orderId ile birleştirilmez.
 */
const getOrderDedupeKey = (order, marketplaceName) => {
    const mp = normalizeMpKey(order.marketplaceName || order.marketplace || marketplaceName);
    if (!mp) return "";

    let id = "";
    if (isCiceksepetiMp(mp)) {
        id = String(order.trackingNumber || order.orderItemId || order.orderNumber || "").trim();
    } else {
        id = String(order.orderNumber || order.trackingNumber || "").trim();
    }
    if (!id || isHbInternalId(id)) return "";
    return `${mp}::${id}`;
};

const dedupeOrderRows = (rows = []) => {
    const map = new Map();
    rows.forEach((order) => {
        const key = getOrderDedupeKey(order);
        if (!key) return;
        const candidate = {
            orderNumber: order.orderNumber || order.trackingNumber,
            orderItemId: order.orderItemId,
            trackingNumber: order.trackingNumber,
            orderDate: order.orderDate,
            updatedAt: order.updatedAt,
            totalPrice: Number(order.totalPrice || order.price || 0),
            status: order.status,
            marketplaceName: order.marketplaceName || order.marketplace,
        };
        map.set(key, pickPreferredOrderRecord(map.get(key), candidate));
    });
    return Array.from(map.values());
};

module.exports = {
    normalizeMpKey,
    isCiceksepetiMp,
    getOrderDedupeKey,
    dedupeOrderRows,
};
