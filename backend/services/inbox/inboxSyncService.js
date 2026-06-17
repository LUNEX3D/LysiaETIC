const StoreInboxConversation = require("../../models/StoreInboxConversation");
const StoreInboxMessage = require("../../models/StoreInboxMessage");
const metaInbox = require("./metaInboxService");
const marketplaceInbox = require("./marketplaceInboxService");
const internalInbox = require("./internalInboxService");
const emailInbox = require("./emailInboxService");
const logger = require("../../config/logger");

async function seedDemoConversation(storeId, channelId, accountLabel) {
    const externalId = `demo_${channelId}_${storeId}`;
    let conv = await StoreInboxConversation.findOne({ storeId, externalId });
    if (conv) return conv;
    const labels = {
        instagram: "Instagram DM",
        facebook: "Facebook Messenger",
        whatsapp: "WhatsApp",
        trendyol: "Trendyol Soru",
        amazon: "Amazon Mesaj",
        form: "Form Mesajı",
        email: "E-posta",
        livechat: "Canlı Sohbet",
    };
    conv = await StoreInboxConversation.create({
        storeId,
        channelId,
        externalId,
        participantName: "Örnek Müşteri",
        participantUsername: "demo_user",
        lastMessageText: `${labels[channelId] || channelId} üzerinden örnek mesaj.`,
        lastMessageAt: new Date(),
        unreadCount: 1,
    });
    await StoreInboxMessage.insertMany([
        {
            storeId,
            conversationId: conv._id,
            externalId: "demo_in",
            direction: "in",
            text: `Merhaba, ${labels[channelId] || channelId} kanalından yazıyorum.`,
            sentAt: new Date(Date.now() - 600000),
            fromName: "Örnek Müşteri",
        },
        {
            storeId,
            conversationId: conv._id,
            externalId: "demo_out",
            direction: "out",
            text: "Merhaba! Size nasıl yardımcı olabilirim?",
            sentAt: new Date(Date.now() - 300000),
            fromName: accountLabel || "Dashtock",
        },
    ]);
    return conv;
}

async function syncStoreInbox(storeId, userId) {
    const StoreInboxSettings = require("../../models/StoreInboxSettings");
    const doc = await StoreInboxSettings.findOne({ storeId }).lean();
    if (!doc) return { synced: 0 };
    let total = 0;
    for (const ch of doc.channels || []) {
        if (!ch.connected) continue;
        try {
            let r = { synced: 0 };
            if (metaInbox.META_CHANNEL_IDS.includes(ch.channelId)) {
                r = await metaInbox.syncMetaChannel(storeId, ch.channelId);
            } else if (marketplaceInbox.MARKETPLACE_CHANNELS[ch.channelId]) {
                r = await marketplaceInbox.syncMarketplaceChannel(storeId, userId, ch.channelId);
            } else if (ch.channelId === "email") {
                r = await emailInbox.syncEmailInbox(storeId);
            }
            total += r.synced || 0;
        } catch (e) {
            logger.warn(`[Inbox sync] ${ch.channelId}:`, e.message);
        }
    }
    return { synced: total };
}

async function listConversations(storeId, userId, options = {}) {
    const { sync = false } = options;
    if (sync) await syncStoreInbox(storeId, userId).catch(() => {});
    return StoreInboxConversation.find({ storeId })
        .sort({ lastMessageAt: -1, updatedAt: -1, createdAt: -1 })
        .lean();
}

async function listMessages(storeId, userId, conversationId) {
    let conv = await StoreInboxConversation.findOne({ _id: conversationId, storeId }).lean();
    if (!conv) return { error: "Konuşma bulunamadı" };
    if (conv.channelId === "trendyol" && userId) {
        conv = await marketplaceInbox.refreshTrendyolConversation(storeId, userId, conv);
    }
    const messages = await StoreInboxMessage.find({ conversationId: conv._id }).sort({ sentAt: 1 }).lean();
    await StoreInboxConversation.updateOne({ _id: conv._id }, { $set: { unreadCount: 0 } });
    return { conversation: conv, messages };
}

async function sendMessage(storeId, userId, conversationId, text) {
    const conv = await StoreInboxConversation.findOne({ _id: conversationId, storeId });
    if (!conv) return { error: "Konuşma bulunamadı" };
    const trimmed = String(text || "").trim();
    if (!trimmed) return { error: "Mesaj boş olamaz" };

    if (metaInbox.META_CHANNEL_IDS.includes(conv.channelId)) {
        return metaInbox.sendMetaMessage(storeId, conversationId, trimmed);
    }
    if (marketplaceInbox.MARKETPLACE_CHANNELS[conv.channelId]) {
        return marketplaceInbox.sendMarketplaceMessage(storeId, userId, conversationId, trimmed);
    }
    if (internalInbox.INTERNAL_CHANNELS.includes(conv.channelId) || conv.channelId === "email") {
        return internalInbox.sendInternalReply(storeId, conversationId, trimmed);
    }
    return { error: "Bu kanal için yanıt desteklenmiyor" };
}

module.exports = {
    seedDemoConversation,
    syncStoreInbox,
    listConversations,
    listMessages,
    sendMessage,
};
