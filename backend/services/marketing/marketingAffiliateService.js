const crypto = require("crypto");
const MarketingAffiliate = require("../../models/MarketingAffiliate");
const MarketingEvent = require("../../models/MarketingEvent");
const StoreOrder = require("../../models/StoreOrder");

function generateCode(name) {
    const base = String(name || "REF")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 6)
        .toUpperCase();
    const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
    return `${base || "REF"}${suffix}`;
}

async function listAffiliates(storeId) {
    return MarketingAffiliate.find({ storeId }).sort({ createdAt: -1 }).lean();
}

async function createAffiliate(storeId, userId, body) {
    let code = String(body.code || "").trim().toUpperCase();
    if (!code) code = generateCode(body.name);
    const doc = await MarketingAffiliate.create({
        storeId,
        userId,
        name: body.name,
        email: body.email || "",
        code,
        commissionType: body.commissionType || "percent",
        commissionValue: Number(body.commissionValue) || 10,
        status: body.status || "active",
    });
    return doc.toObject();
}

async function updateAffiliate(storeId, id, body) {
    const patch = {};
    for (const k of ["name", "email", "code", "commissionType", "commissionValue", "status"]) {
        if (body[k] !== undefined) patch[k] = body[k];
    }
    return MarketingAffiliate.findOneAndUpdate({ _id: id, storeId }, { $set: patch }, { new: true }).lean();
}

async function deleteAffiliate(storeId, id) {
    await MarketingAffiliate.deleteOne({ _id: id, storeId });
    return { ok: true };
}

async function findByCode(storeId, code) {
    return MarketingAffiliate.findOne({
        storeId,
        code: String(code || "").trim().toUpperCase(),
        status: "active",
    }).lean();
}

async function trackClick(storeId, code, meta = {}) {
    const aff = await findByCode(storeId, code);
    if (!aff) return { error: "Geçersiz referans kodu" };
    await MarketingAffiliate.updateOne({ _id: aff._id }, { $inc: { "stats.clicks": 1 } });
    await MarketingEvent.create({
        storeId,
        type: "affiliate_click",
        channel: "AFFILIATE",
        affiliateId: aff._id,
        meta: { code, ...meta },
    });
    return { affiliateId: aff._id, code: aff.code };
}

async function attributeOrderSale(storeId, orderId, affiliateId, orderTotal) {
    const aff = await MarketingAffiliate.findOne({ _id: affiliateId, storeId });
    if (!aff) return;
    const total = Number(orderTotal) || 0;
    let commission = 0;
    if (aff.commissionType === "fixed") commission = Number(aff.commissionValue) || 0;
    else commission = (total * (Number(aff.commissionValue) || 0)) / 100;

    await MarketingAffiliate.updateOne(
        { _id: aff._id },
        {
            $inc: {
                "stats.orders": 1,
                "stats.revenue": total,
                "stats.commissionOwed": commission,
            },
        }
    );

    await MarketingEvent.create({
        storeId,
        type: "affiliate_sale",
        channel: "AFFILIATE",
        affiliateId: aff._id,
        orderId,
        revenue: total,
        meta: { commission },
    });
}

async function applyAffiliateToOrder(order, refCode) {
    if (!order?.storeId || !refCode) return order;
    const aff = await findByCode(order.storeId, refCode);
    if (!aff) return order;
    order.marketingSource = {
        channel: "AFFILIATE",
        affiliateId: aff._id,
        refCode: aff.code,
        attributedAt: new Date(),
    };
    await order.save();
    await attributeOrderSale(order.storeId, order._id, aff._id, order.total);
    return order;
}

module.exports = {
    listAffiliates,
    createAffiliate,
    updateAffiliate,
    deleteAffiliate,
    findByCode,
    trackClick,
    attributeOrderSale,
    applyAffiliateToOrder,
};
