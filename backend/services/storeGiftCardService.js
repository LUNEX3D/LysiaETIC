const StoreGiftCard = require("../models/StoreGiftCard");
const { buildSalesChannels } = require("./storeCartLinkService");

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 10) {
    let out = "";
    for (let i = 0; i < length; i++) {
        out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return out;
}

async function generateUniqueCode(storeId) {
    for (let i = 0; i < 12; i++) {
        const code = randomCode(10);
        const exists = await StoreGiftCard.exists({ storeId, code });
        if (!exists) return code;
    }
    return `${Date.now().toString(36).toUpperCase().slice(-8)}`;
}

function normalizePayload(body) {
    const code = String(body.code || "")
        .trim()
        .toUpperCase()
        .slice(0, 20);
    const initialAmount = Math.max(0, Number(body.initialAmount) || 0);
    const usedAmount = Math.max(0, Number(body.usedAmount) || 0);
    const minOrderAmount =
        body.minOrderAmount === null || body.minOrderAmount === ""
            ? null
            : Math.max(0, Number(body.minOrderAmount) || 0);
    const startDate = body.startDate ? new Date(body.startDate) : null;
    const endDate = body.endDate ? new Date(body.endDate) : null;
    const salesChannelIds = Array.isArray(body.salesChannelIds)
        ? body.salesChannelIds.map((id) => String(id).trim()).filter(Boolean)
        : [];
    return {
        code,
        initialAmount,
        usedAmount,
        currency: String(body.currency || "TRY").trim() || "TRY",
        active: body.active !== false,
        minOrderAmount,
        startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : null,
        endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null,
        customer: {
            name: String(body.customer?.name || "").trim(),
            email: String(body.customer?.email || "").trim(),
            phone: String(body.customer?.phone || "").trim(),
        },
        salesChannelIds,
    };
}

async function listGiftCards(storeId, { q, limit = 200 } = {}) {
    const rows = await StoreGiftCard.find({ storeId }).sort({ createdAt: -1 }).limit(limit).lean();
    if (!q) return rows;
    const needle = String(q).trim().toLowerCase();
    return rows.filter((c) => {
        if (c.code?.toLowerCase().includes(needle)) return true;
        if (c.customer?.name?.toLowerCase().includes(needle)) return true;
        if (c.customer?.email?.toLowerCase().includes(needle)) return true;
        return false;
    });
}

async function getGiftCard(storeId, id) {
    return StoreGiftCard.findOne({ _id: id, storeId }).lean();
}

async function createGiftCard(storeId, userId, body, actorName) {
    const data = normalizePayload(body);
    if (!data.code) {
        data.code = await generateUniqueCode(storeId);
    }
    if (!data.initialAmount) return { error: "Hediye kartı değeri gerekli" };
    try {
        const doc = await StoreGiftCard.create({
            storeId,
            userId,
            ...data,
            timeline: [
                {
                    type: "created",
                    actor: actorName || "Personel",
                    message: `${data.initialAmount} ${data.currency} hediye kartı oluşturuldu`,
                    createdAt: new Date(),
                },
            ],
        });
        return { giftCard: doc.toObject() };
    } catch (e) {
        if (e.code === 11000) return { error: "Bu hediye kartı kodu zaten kullanılıyor" };
        throw e;
    }
}

async function updateGiftCard(storeId, id, body, actorName) {
    const doc = await StoreGiftCard.findOne({ _id: id, storeId });
    if (!doc) return { error: "Hediye kartı bulunamadı" };
    const data = normalizePayload({ ...doc.toObject(), ...body });
    if (!data.code) return { error: "Hediye kartı kodu gerekli" };
    if (!data.initialAmount) return { error: "Hediye kartı değeri gerekli" };
    if (body.comment?.trim()) {
        doc.timeline = doc.timeline || [];
        doc.timeline.push({
            type: "comment",
            actor: actorName || "Personel",
            message: body.comment.trim(),
            createdAt: new Date(),
        });
    }
    doc.code = data.code;
    doc.initialAmount = data.initialAmount;
    doc.usedAmount = Math.min(data.usedAmount, data.initialAmount);
    doc.currency = data.currency;
    doc.active = data.active;
    doc.minOrderAmount = data.minOrderAmount;
    doc.startDate = data.startDate;
    doc.endDate = data.endDate;
    doc.customer = data.customer;
    doc.salesChannelIds = data.salesChannelIds;
    try {
        await doc.save();
        return { giftCard: doc.toObject() };
    } catch (e) {
        if (e.code === 11000) return { error: "Bu hediye kartı kodu zaten kullanılıyor" };
        throw e;
    }
}

async function deleteGiftCard(storeId, id) {
    const doc = await StoreGiftCard.findOneAndDelete({ _id: id, storeId });
    if (!doc) return { error: "Hediye kartı bulunamadı" };
    return { ok: true };
}

async function suggestCode(storeId) {
    return { code: await generateUniqueCode(storeId) };
}

function resolveSalesChannelLabels(store, ids) {
    const channels = buildSalesChannels(store);
    const map = new Map(channels.map((c) => [c.id, c.label]));
    return (ids || []).map((id) => map.get(id) || id).filter(Boolean);
}

module.exports = {
    listGiftCards,
    getGiftCard,
    createGiftCard,
    updateGiftCard,
    deleteGiftCard,
    suggestCode,
    resolveSalesChannelLabels,
    generateUniqueCode,
};
