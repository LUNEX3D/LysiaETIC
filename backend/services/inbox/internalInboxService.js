const crypto = require("crypto");
const Store = require("../../models/Store");
const StoreInboxSettings = require("../../models/StoreInboxSettings");
const StoreInboxConversation = require("../../models/StoreInboxConversation");
const StoreInboxMessage = require("../../models/StoreInboxMessage");

const INTERNAL_CHANNELS = ["form", "livechat"];

async function upsertInternalChannel(storeId, userId, channelId, label) {
    const full = await StoreInboxSettings.findOne({ storeId }).select("+channels.accessToken");
    if (!full) throw new Error("Gelen kutusu ayarları yok");
    const existing = full.channels || [];
    full.channels = StoreInboxSettings.CHANNEL_IDS.map((id) => {
        const prev = existing.find((c) => c.channelId === id) || { channelId: id };
        if (id !== channelId) return { ...prev, channelId: id };
        return {
            ...prev,
            channelId,
            connected: true,
            accountLabel: label,
            connectedAt: new Date(),
        };
    });
    full.onboardingStep = "done";
    await full.save();
    const { getOrCreateSettings } = require("../storeInboxService");
    return getOrCreateSettings(storeId, userId);
}

async function connectInternalChannel(storeId, userId, channelId, { accountLabel = "" } = {}) {
    const store = await Store.findById(storeId).lean();
    if (!store) return { error: "Mağaza bulunamadı" };

    let label = String(accountLabel || "").trim();
    if (channelId === "form") {
        label = label || store.name || "Mağaza Formu";
    } else if (channelId === "livechat") {
        label = label || `${store.name || "Mağaza"} Canlı Sohbet`;
    }

    const settings = await upsertInternalChannel(storeId, userId, channelId, label.slice(0, 120));
    return { settings };
}

async function ingestPublicMessage(storeId, channelId, payload) {
    const { name, email, phone, text, subject } = payload;
    const body = String(text || subject || "").trim();
    if (!body) return { error: "Mesaj boş" };

    const externalId = `pub_${crypto.createHash("sha1").update(`${channelId}:${email}:${Date.now()}`).digest("hex").slice(0, 16)}`;
    const participantName = String(name || email || phone || "Ziyaretçi").slice(0, 120);

    let conv = null;
    if (email) {
        conv = await StoreInboxConversation.findOne({
            storeId,
            channelId,
            participantUsername: email,
        });
    }
    if (!conv) {
        conv = await StoreInboxConversation.create({
            storeId,
            channelId,
            externalId,
            participantName,
            participantUsername: email || phone || "",
            lastMessageText: body,
            lastMessageAt: new Date(),
            unreadCount: 1,
        });
    } else {
        await StoreInboxConversation.updateOne(
            { _id: conv._id },
            {
                $set: { lastMessageText: body, lastMessageAt: new Date() },
                $inc: { unreadCount: 1 },
            }
        );
    }

    const msg = await StoreInboxMessage.create({
        storeId,
        conversationId: conv._id,
        externalId: `m_${Date.now()}`,
        direction: "in",
        text: body,
        sentAt: new Date(),
        fromName: participantName,
    });
    return { conversationId: conv._id, message: msg };
}

async function sendInternalReply(storeId, conversationId, text) {
    const conv = await StoreInboxConversation.findOne({ _id: conversationId, storeId });
    if (!conv) return { error: "Konuşma bulunamadı" };
    if (!INTERNAL_CHANNELS.includes(conv.channelId)) return { error: "Kanal desteklenmiyor" };

    const msg = await StoreInboxMessage.create({
        storeId,
        conversationId: conv._id,
        externalId: `out_${Date.now()}`,
        direction: "out",
        text,
        sentAt: new Date(),
        fromName: "Mağaza",
    });
    await StoreInboxConversation.updateOne(
        { _id: conv._id },
        { $set: { lastMessageText: text, lastMessageAt: new Date(), unreadCount: 0 } }
    );
    return { message: msg };
}

module.exports = {
    INTERNAL_CHANNELS,
    connectInternalChannel,
    ingestPublicMessage,
    sendInternalReply,
};
