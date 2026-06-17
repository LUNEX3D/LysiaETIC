/**
 * Sipariş eşleştirme — sync ve e-posta dedupe için ortak anahtarlar
 */

const { isHbInternalId, resolveHepsiburadaOrderKey } = require("../services/hepsiburadaService");

const addClause = (or, field, value) => {
    const s = value == null ? "" : String(value).trim();
    if (!s || isHbInternalId(s)) return;
    or.push({ [field]: s });
};

/**
 * MongoDB $or maddeleri — aynı iş siparişini farklı tracking alanlarıyla bul
 */
const collectOrderMatchClauses = (order = {}, opts = {}) => {
    const {
        orderNumber = "",
        tracking = "",
        isHepsiburada = false,
        isCiceksepeti = false,
    } = opts;

    const or = [];
    addClause(or, "trackingNumber", tracking);
    addClause(or, "trackingNumber", orderNumber);
    addClause(or, "packageNumber", order.packageNumber);
    addClause(or, "orderItemId", order.orderItemId);

    if (isCiceksepeti) {
        addClause(or, "trackingNumber", order.orderItemId);
        addClause(or, "packageNumber", order.orderNumber || order.packageNumber);
    }

    if (isHepsiburada) {
        const merchantNo = resolveHepsiburadaOrderKey(order, null) || orderNumber;
        addClause(or, "trackingNumber", merchantNo);
        addClause(or, "packageNumber", merchantNo);
        addClause(or, "packageNumber", order.packageNumber);
    }

    // Tekilleştir
    const seen = new Set();
    return or.filter((c) => {
        const key = `${Object.keys(c)[0]}:${Object.values(c)[0]}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

module.exports = {
    collectOrderMatchClauses,
};
