const StoreCampaign = require("../models/StoreCampaign");

const TITLE_MAX = 200;

function normalizeTitle(title) {
    return String(title || "").trim().slice(0, TITLE_MAX);
}

function normalizeCode(code) {
    return String(code || "")
        .trim()
        .toUpperCase()
        .slice(0, 64);
}

function pickBody(body) {
    const out = {};
    if (body.title !== undefined) out.title = normalizeTitle(body.title);
    if (body.kind === "automatic" || body.kind === "code") out.kind = body.kind;
    if (body.code !== undefined) out.code = normalizeCode(body.code);
    if (
        ["percentage", "fixed", "free_shipping", "buy_x_get_y"].includes(body.discountType)
    ) {
        out.discountType = body.discountType;
    }
    if (body.discountValue !== undefined) out.discountValue = Math.max(0, Number(body.discountValue) || 0);
    if (body.scope === "all_products" || body.scope === "specific_products") out.scope = body.scope;
    if (body.includeDiscountedProducts !== undefined) {
        out.includeDiscountedProducts = !!body.includeDiscountedProducts;
    }
    if (Array.isArray(body.productRules)) out.productRules = body.productRules;
    if (body.requirements && typeof body.requirements === "object") out.requirements = body.requirements;
    if (body.buyXGetY && typeof body.buyXGetY === "object") out.buyXGetY = body.buyXGetY;
    if (body.usageLimits && typeof body.usageLimits === "object") out.usageLimits = body.usageLimits;
    if (body.customers && typeof body.customers === "object") out.customers = body.customers;
    if (body.settings && typeof body.settings === "object") out.settings = body.settings;
    if (body.dates && typeof body.dates === "object") out.dates = body.dates;
    if (body.extraDiscounts && typeof body.extraDiscounts === "object") {
        out.extraDiscounts = body.extraDiscounts;
    }
    if (body.priceBasis === "sale" || body.priceBasis === "discounted") {
        out.priceBasis = body.priceBasis;
    }
    if (["products", "categories", "brands", "tags"].includes(body.buyRuleTarget)) {
        out.buyRuleTarget = body.buyRuleTarget;
    }
    if (body.active !== undefined) out.active = !!body.active;
    return out;
}

async function listCampaigns(storeId, { kind, q } = {}) {
    const filter = { storeId };
    if (kind === "automatic" || kind === "code") filter.kind = kind;
    const query = q ? String(q).trim().toLowerCase() : "";
    let rows = await StoreCampaign.find(filter).sort({ createdAt: -1 }).lean();
    if (query) {
        rows = rows.filter(
            (c) =>
                (c.title || "").toLowerCase().includes(query) ||
                (c.code || "").toLowerCase().includes(query)
        );
    }
    return rows;
}

async function getCampaign(storeId, id) {
    return StoreCampaign.findOne({ _id: id, storeId }).lean();
}

async function createCampaign(storeId, userId, body) {
    const title = normalizeTitle(body.title);
    if (!title) return { error: "İndirim başlığı gerekli" };
    const kind = body.kind === "code" ? "code" : "automatic";
    const code = normalizeCode(body.code);
    if (kind === "code" && !code) return { error: "İndirim kodu gerekli" };
    try {
        const doc = await StoreCampaign.create({
            storeId,
            userId,
            title,
            kind,
            code: kind === "code" ? code : "",
            ...pickBody(body),
        });
        return { campaign: doc.toObject() };
    } catch (e) {
        if (e.code === 11000) return { error: "Bu indirim kodu zaten kullanılıyor" };
        throw e;
    }
}

async function updateCampaign(storeId, id, body) {
    const doc = await StoreCampaign.findOne({ _id: id, storeId });
    if (!doc) return { error: "Kampanya bulunamadı" };
    const patch = pickBody(body);
    if (patch.title !== undefined) {
        if (!patch.title) return { error: "İndirim başlığı gerekli" };
        doc.title = patch.title;
    }
    if (patch.kind) doc.kind = patch.kind;
    if (patch.code !== undefined) {
        doc.code = patch.code;
        if (doc.kind === "code" && !doc.code) return { error: "İndirim kodu gerekli" };
    }
    if (patch.discountType) doc.discountType = patch.discountType;
    if (patch.discountValue !== undefined) doc.discountValue = patch.discountValue;
    if (patch.scope) doc.scope = patch.scope;
    if (patch.includeDiscountedProducts !== undefined) {
        doc.includeDiscountedProducts = patch.includeDiscountedProducts;
    }
    if (patch.productRules) doc.productRules = patch.productRules;
    if (patch.requirements) doc.requirements = { ...doc.requirements?.toObject?.() || doc.requirements, ...patch.requirements };
    if (patch.buyXGetY) doc.buyXGetY = { ...doc.buyXGetY?.toObject?.() || doc.buyXGetY, ...patch.buyXGetY };
    if (patch.usageLimits) doc.usageLimits = { ...doc.usageLimits?.toObject?.() || doc.usageLimits, ...patch.usageLimits };
    if (patch.customers) doc.customers = { ...doc.customers?.toObject?.() || doc.customers, ...patch.customers };
    if (patch.settings) doc.settings = { ...doc.settings?.toObject?.() || doc.settings, ...patch.settings };
    if (patch.dates) doc.dates = { ...doc.dates?.toObject?.() || doc.dates, ...patch.dates };
    if (patch.active !== undefined) doc.active = patch.active;
    try {
        await doc.save();
    } catch (e) {
        if (e.code === 11000) return { error: "Bu indirim kodu zaten kullanılıyor" };
        throw e;
    }
    return { campaign: doc.toObject() };
}

async function deleteCampaign(storeId, id) {
    const doc = await StoreCampaign.findOne({ _id: id, storeId });
    if (!doc) return { error: "Kampanya bulunamadı" };
    await doc.deleteOne();
    return { ok: true };
}

module.exports = {
    listCampaigns,
    getCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    TITLE_MAX,
};
