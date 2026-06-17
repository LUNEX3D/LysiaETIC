/**
 * Meta kanalları: Instagram DM, Facebook Messenger, WhatsApp Business (Cloud API)
 */
const axios = require("axios");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const StoreInboxSettings = require("../../models/StoreInboxSettings");
const StoreInboxConversation = require("../../models/StoreInboxConversation");
const StoreInboxMessage = require("../../models/StoreInboxMessage");
const { APP_URL } = require("../../config/domain");
const logger = require("../../config/logger");

const GRAPH_VERSION = "v21.0";
const FB_OAUTH = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const FB_GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

const META_CHANNEL_IDS = ["instagram", "facebook", "whatsapp"];

function isMetaConfigured() {
    return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

function isDemoMode() {
    return String(process.env.INBOX_IG_DEMO || process.env.INBOX_DEMO || "").toLowerCase() === "true";
}

function getRedirectUri() {
    const base = (process.env.BACKEND_PUBLIC_URL || process.env.APP_URL || "http://localhost:5000").replace(
        /\/$/,
        ""
    );
    return `${base}/api/store/inbox/instagram/oauth/callback`;
}

function signOAuthState(storeId, userId, targetChannel = "instagram") {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET tanımlı değil");
    return jwt.sign(
        { storeId: String(storeId), userId: String(userId), purpose: "inbox_meta", targetChannel },
        secret,
        { expiresIn: "20m" }
    );
}

function verifyOAuthState(state) {
    const secret = process.env.JWT_SECRET;
    const payload = jwt.verify(state, secret);
    if (payload.purpose !== "inbox_meta" && payload.purpose !== "inbox_instagram") {
        throw new Error("Geçersiz OAuth state");
    }
    return payload;
}

function buildOAuthUrl(storeId, userId, targetChannel = "instagram") {
    if (!isMetaConfigured()) {
        return { error: "META_APP_ID ve META_APP_SECRET .env dosyasında tanımlanmalıdır." };
    }
    const redirectUri = getRedirectUri();
    const state = signOAuthState(storeId, userId, targetChannel);
    const scope = [
        "instagram_basic",
        "instagram_manage_messages",
        "pages_show_list",
        "pages_messaging",
        "pages_read_engagement",
        "pages_manage_metadata",
        "business_management",
        "whatsapp_business_management",
        "whatsapp_business_messaging",
    ].join(",");
    const params = new URLSearchParams({
        client_id: process.env.META_APP_ID,
        redirect_uri: redirectUri,
        state,
        scope,
        response_type: "code",
    });
    return { url: `${FB_OAUTH}?${params.toString()}` };
}

async function exchangeCodeForToken(code) {
    const redirectUri = getRedirectUri();
    const { data } = await axios.get(`${FB_GRAPH}/oauth/access_token`, {
        params: {
            client_id: process.env.META_APP_ID,
            client_secret: process.env.META_APP_SECRET,
            redirect_uri: redirectUri,
            code,
        },
    });
    return data.access_token;
}

async function getLongLivedToken(shortToken) {
    const { data } = await axios.get(`${FB_GRAPH}/oauth/access_token`, {
        params: {
            grant_type: "fb_exchange_token",
            client_id: process.env.META_APP_ID,
            client_secret: process.env.META_APP_SECRET,
            fb_exchange_token: shortToken,
        },
    });
    return { accessToken: data.access_token, expiresIn: data.expires_in || null };
}

async function resolveMetaAssets(userAccessToken) {
    const { data } = await axios.get(`${FB_GRAPH}/me/accounts`, {
        params: {
            access_token: userAccessToken,
            fields:
                "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url},connected_whatsapp_business_account{id}",
        },
    });
    const pages = data.data || [];
    for (const page of pages) {
        const ig = page.instagram_business_account;
        let waPhoneId = "";
        const waBizId = page.connected_whatsapp_business_account?.id;
        if (waBizId && page.access_token) {
            try {
                const wa = await axios.get(`${FB_GRAPH}/${waBizId}/phone_numbers`, {
                    params: { access_token: page.access_token, fields: "id,display_phone_number" },
                });
                waPhoneId = wa.data?.data?.[0]?.id || "";
            } catch (e) {
                logger.warn("[Inbox Meta] WhatsApp phone:", e.message);
            }
        }
        return {
            pageId: page.id,
            pageName: page.name,
            pageAccessToken: page.access_token,
            igUserId: ig?.id || "",
            igUsername: ig?.username || "",
            igName: ig?.name || "",
            waPhoneId,
            tokenExpiresAt: null,
        };
    }
    return null;
}

async function getChannelCredentials(storeId, channelId) {
    const doc = await StoreInboxSettings.findOne({ storeId }).select("+channels.accessToken").lean();
    if (!doc) return null;
    const ch = (doc.channels || []).find((c) => c.channelId === channelId && c.connected);
    if (!ch?.accessToken) return null;
    return ch;
}

async function upsertChannel(storeId, userId, channelId, patch) {
    await StoreInboxSettings.findOne({ storeId }).then(async (doc) => {
        if (!doc) {
            await StoreInboxSettings.create({
                storeId,
                userId,
                onboardingStep: "done",
                channels: StoreInboxSettings.CHANNEL_IDS.map((id) => ({ channelId: id, connected: false })),
            });
        }
    });
    const full = await StoreInboxSettings.findOne({ storeId }).select("+channels.accessToken");
    const existing = full.channels || [];
    full.channels = StoreInboxSettings.CHANNEL_IDS.map((id) => {
        const prev = existing.find((c) => c.channelId === id) || { channelId: id };
        if (id !== channelId) return { ...prev, channelId: id };
        return { ...prev, channelId, ...patch, connected: true, connectedAt: patch.connectedAt || new Date() };
    });
    full.onboardingStep = "done";
    await full.save();
    const { getOrCreateSettings } = require("../storeInboxService");
    return getOrCreateSettings(storeId, userId);
}

async function connectMetaChannel(storeId, userId, channelId) {
    if (!META_CHANNEL_IDS.includes(channelId)) return { error: "Geçersiz Meta kanalı" };
    if (isMetaConfigured()) {
        const oauth = buildOAuthUrl(storeId, userId, channelId);
        if (oauth.error) return { error: oauth.error };
        return { oauthUrl: oauth.url };
    }
    if (isDemoMode()) {
        const label = `@dashtock_${channelId}`;
        await upsertChannel(storeId, userId, channelId, {
            accountLabel: label,
            accessToken: "demo_token",
            pageId: `demo_${channelId}`,
            igUserId: channelId === "instagram" ? "demo_ig" : "",
            externalRef: `demo_${channelId}`,
        });
        const { seedDemoConversation } = require("./inboxSyncService");
        await seedDemoConversation(storeId, channelId, label);
        const { getOrCreateSettings } = require("../storeInboxService");
        return { settings: await getOrCreateSettings(storeId, userId) };
    }
    return { error: "META_APP_ID / META_APP_SECRET tanımlayın veya INBOX_DEMO=true kullanın." };
}

async function handleOAuthCallback(code, state) {
    const payload = verifyOAuthState(state);
    const { storeId, userId, targetChannel = "instagram" } = payload;
    const shortToken = await exchangeCodeForToken(code);
    const long = await getLongLivedToken(shortToken);
    const assets = await resolveMetaAssets(long.accessToken);
    if (!assets) {
        return { error: "Facebook sayfası bulunamadı. Meta Business’ta sayfa ve Instagram/WhatsApp bağlantısını kontrol edin." };
    }
    assets.tokenExpiresAt = long.expiresIn ? new Date(Date.now() + long.expiresIn * 1000) : null;

    const toEnable = [];
    if (assets.igUserId) toEnable.push("instagram");
    if (assets.pageId) toEnable.push("facebook");
    if (assets.waPhoneId) toEnable.push("whatsapp");

    if (targetChannel === "instagram" && !assets.igUserId) {
        return { error: "Bu sayfada Instagram Business hesabı yok." };
    }
    if (targetChannel === "whatsapp" && !assets.waPhoneId) {
        return { error: "Bu sayfada WhatsApp Business numarası yok." };
    }

    const enable = toEnable.includes(targetChannel) ? [targetChannel, ...toEnable] : toEnable;
    const uniqueEnable = [...new Set(enable)];

    for (const chId of uniqueEnable) {
        let label = assets.pageName;
        if (chId === "instagram") label = assets.igUsername ? `@${assets.igUsername}` : assets.igName || "Instagram";
        if (chId === "whatsapp") label = "WhatsApp Business";
        if (chId === "facebook") label = assets.pageName || "Facebook";
        await upsertChannel(storeId, userId, chId, {
            accountLabel: label,
            pageId: assets.pageId,
            igUserId: assets.igUserId,
            accessToken: assets.pageAccessToken,
            externalRef: chId === "whatsapp" ? assets.waPhoneId : assets.pageId,
            tokenExpiresAt: assets.tokenExpiresAt,
        });
    }

    const { syncStoreInbox } = require("./inboxSyncService");
    await syncStoreInbox(storeId, userId).catch((e) => logger.warn("[Inbox Meta] sync:", e.message));
    const { getOrCreateSettings } = require("../storeInboxService");
    return { settings: await getOrCreateSettings(storeId, userId), storeId, userId };
}

async function graphGet(path, params) {
    const { data } = await axios.get(`${FB_GRAPH}${path}`, { params });
    return data;
}

async function upsertConversationFromThread(storeId, channelId, thread, ch) {
    const participants = thread.participants?.data || [];
    const selfId = channelId === "instagram" ? ch.igUserId : ch.pageId;
    const customer = participants.find((p) => p.id !== selfId) || participants[0];
    const name = customer?.name || customer?.username || "Müşteri";
    let conv = await StoreInboxConversation.findOneAndUpdate(
        { storeId, channelId, externalId: thread.id },
        {
            $set: {
                participantName: name,
                participantUsername: customer?.username || "",
                lastMessageAt: thread.updated_time ? new Date(thread.updated_time) : new Date(),
            },
        },
        { upsert: true, new: true }
    );
    await syncThreadMessages(storeId, channelId, conv, ch);
    return conv;
}

async function syncThreadMessages(storeId, channelId, conv, ch) {
    if (ch.accessToken === "demo_token") return;
    const platform = channelId === "instagram" ? "instagram" : channelId === "facebook" ? "messenger" : null;
    const path =
        channelId === "whatsapp"
            ? `/${ch.externalRef || ch.pageId}/messages`
            : `/${conv.externalId}`;
    const fields =
        channelId === "whatsapp"
            ? "messages{id,text,from,timestamp}"
            : "messages{id,message,from,created_time}";
    const data = await graphGet(path, { access_token: ch.accessToken, fields });
    const messages = data.messages?.data || [];
    let lastText = "";
    let lastAt = null;
    for (const m of [...messages].reverse()) {
        const text = m.message || m.text?.body || m.text || "";
        const fromId = m.from?.id;
        const direction =
            fromId === ch.igUserId || fromId === ch.pageId || m.from?.id === "me" ? "out" : "in";
        await StoreInboxMessage.findOneAndUpdate(
            { conversationId: conv._id, externalId: m.id },
            {
                $set: {
                    storeId,
                    direction,
                    text,
                    sentAt: m.created_time || m.timestamp ? new Date(m.created_time || m.timestamp * 1000) : new Date(),
                    fromName: m.from?.name || "",
                },
            },
            { upsert: true }
        );
        if (text) {
            lastText = text;
            lastAt = m.created_time ? new Date(m.created_time) : new Date();
        }
    }
    if (lastText) {
        await StoreInboxConversation.updateOne(
            { _id: conv._id },
            { $set: { lastMessageText: lastText, lastMessageAt: lastAt } }
        );
    }
}

async function syncMetaChannel(storeId, channelId) {
    const ch = await getChannelCredentials(storeId, channelId);
    if (!ch) return { synced: 0 };
    if (ch.accessToken === "demo_token") return { synced: 0 };

    let synced = 0;
    if (channelId === "whatsapp" && ch.externalRef) {
        const data = await graphGet(`/${ch.externalRef}/conversations`, {
            access_token: ch.accessToken,
            fields: "id,updated_time,participants",
        });
        for (const item of data.data || []) {
            await upsertConversationFromThread(storeId, channelId, item, ch);
            synced++;
        }
        return { synced };
    }

    const platform = channelId === "instagram" ? "instagram" : "messenger";
    const data = await graphGet(`/${ch.pageId}/conversations`, {
        access_token: ch.accessToken,
        platform,
        fields: "id,updated_time,participants",
        limit: 50,
    });
    for (const item of data.data || []) {
        await upsertConversationFromThread(storeId, channelId, item, ch);
        synced++;
    }
    return { synced };
}

async function sendMetaMessage(storeId, conversationId, text) {
    const conv = await StoreInboxConversation.findOne({ _id: conversationId, storeId });
    if (!conv) return { error: "Konuşma bulunamadı" };
    const ch = await getChannelCredentials(storeId, conv.channelId);
    if (!ch) return { error: "Kanal bağlı değil" };

    if (ch.accessToken === "demo_token") {
        const msg = await StoreInboxMessage.create({
            storeId,
            conversationId: conv._id,
            externalId: `demo_${crypto.randomUUID()}`,
            direction: "out",
            text,
            sentAt: new Date(),
            fromName: ch.accountLabel || "",
        });
        await StoreInboxConversation.updateOne(
            { _id: conv._id },
            { $set: { lastMessageText: text, lastMessageAt: new Date() } }
        );
        return { message: msg };
    }

    const thread = await graphGet(`/${conv.externalId}`, {
        access_token: ch.accessToken,
        fields: "participants",
    });
    const participants = thread.participants?.data || [];
    const recipient = participants.find((p) => p.id !== ch.igUserId && p.id !== ch.pageId);

    if (conv.channelId === "whatsapp" && ch.externalRef) {
        await axios.post(
            `${FB_GRAPH}/${ch.externalRef}/messages`,
            {
                messaging_product: "whatsapp",
                to: recipient?.id,
                type: "text",
                text: { body: text },
            },
            { params: { access_token: ch.accessToken } }
        );
    } else {
        await axios.post(
            `${FB_GRAPH}/${ch.pageId}/messages`,
            {
                recipient: { id: recipient?.id },
                message: { text },
                messaging_type: "RESPONSE",
            },
            { params: { access_token: ch.accessToken } }
        );
    }

    const msg = await StoreInboxMessage.create({
        storeId,
        conversationId: conv._id,
        externalId: `local_${Date.now()}`,
        direction: "out",
        text,
        sentAt: new Date(),
        fromName: ch.accountLabel || "",
    });
    await StoreInboxConversation.updateOne(
        { _id: conv._id },
        { $set: { lastMessageText: text, lastMessageAt: new Date() } }
    );
    return { message: msg };
}

function getDashboardRedirectUrl(query = {}) {
    const base = (APP_URL || "http://localhost:3000").replace(/\/$/, "");
    return `${base}/dashboard?${new URLSearchParams(query).toString()}`;
}

module.exports = {
    META_CHANNEL_IDS,
    isMetaConfigured,
    isDemoMode,
    buildOAuthUrl,
    connectMetaChannel,
    handleOAuthCallback,
    syncMetaChannel,
    sendMetaMessage,
    getDashboardRedirectUrl,
    getRedirectUri,
};
