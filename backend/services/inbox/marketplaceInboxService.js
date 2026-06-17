const axios = require("axios");
const Marketplace = require("../../models/Marketplace");
const StoreInboxSettings = require("../../models/StoreInboxSettings");
const StoreInboxConversation = require("../../models/StoreInboxConversation");
const StoreInboxMessage = require("../../models/StoreInboxMessage");
const { decryptCredentials } = require("../../utils/encryption");
const logger = require("../../config/logger");

const MARKETPLACE_CHANNELS = {
    trendyol: "Trendyol",
    amazon: "Amazon",
};

function getDecryptedCredentials(mp) {
    if (!mp?.credentials) return {};
    try {
        return decryptCredentials(mp.credentials);
    } catch (e) {
        logger.error("[Inbox] credential decrypt:", e.message);
        return mp.credentials;
    }
}

function parseTrendyolApiError(err) {
    const data = err?.response?.data;
    if (!data) return err?.message || "Trendyol API hatası";
    if (typeof data.message === "string" && data.message) return data.message;
    if (Array.isArray(data.errors) && data.errors[0]?.message) return data.errors[0].message;
    if (data.errors && typeof data.errors === "object") {
        const first = Object.values(data.errors)[0];
        if (first?.message) return first.message;
    }
    if (err.response?.status === 401) {
        return "Unauthorized — API Key / API Secret hatalı veya QnA yetkisi yok. Pazaryeri Entegrasyonu bilgilerini kontrol edin.";
    }
    return JSON.stringify(data).slice(0, 200);
}

async function getMarketplaceForUser(userId, channelId) {
    const name = MARKETPLACE_CHANNELS[channelId];
    if (!name) return null;
    if (channelId === "amazon") {
        return Marketplace.findOne({
            userId,
            isActive: true,
            marketplaceName: { $in: ["Amazon", "Amazon Türkiye", "Amazon Europe", "Amazon USA"] },
        }).lean();
    }
    return Marketplace.findOne({ userId, marketplaceName: name, isActive: true }).lean();
}

async function upsertMarketplaceChannel(storeId, userId, channelId, mp, creds) {
    const sellerLabel =
        creds?.sellerId ||
        creds?.supplierId ||
        creds?.merchantId ||
        mp.marketplaceName;
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
            accountLabel: `${mp.marketplaceName} · ${sellerLabel}`,
            connectedAt: new Date(),
            marketplaceId: String(mp._id),
            accessToken: "",
        };
    });
    full.onboardingStep = "done";
    await full.save();
    const { getOrCreateSettings } = require("../storeInboxService");
    return getOrCreateSettings(storeId, userId);
}

async function connectMarketplaceChannel(storeId, userId, channelId) {
    const mp = await getMarketplaceForUser(userId, channelId);
    if (!mp) {
        return {
            error: `Önce sol menüden Pazaryeri Entegrasyonu bölümünde ${MARKETPLACE_CHANNELS[channelId] || channelId} hesabınızı bağlayın.`,
        };
    }
    const creds = getDecryptedCredentials(mp);
    let synced = 0;
    let syncError = "";
    try {
        const r = await module.exports.syncMarketplaceChannel(storeId, userId, channelId);
        synced = r.synced || 0;
        if (r.error) syncError = r.error;
    } catch (e) {
        syncError = parseTrendyolApiError(e);
        logger.warn(`[Inbox ${channelId}] sync:`, syncError);
    }
    if (syncError && /unauthorized/i.test(syncError)) {
        return { error: syncError };
    }
    const settings = await upsertMarketplaceChannel(storeId, userId, channelId, mp, creds);
    return { settings, synced, syncError };
}

function parseTrendyolDate(value) {
    if (value == null || value === "") return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
}

function extractTrendyolAnswer(q) {
    if (!q) return { text: "", sentAt: null };
    const answer = q.answer;
    const text =
        (answer && typeof answer === "object" ? answer.text : null) ||
        (typeof answer === "string" ? answer : "") ||
        q.answerText ||
        "";
    const sentAt = parseTrendyolDate(
        (answer && typeof answer === "object" ? answer.creationDate : null) || q.answeredDate || q.answerDate
    );
    return { text: String(text || "").trim(), sentAt };
}

async function syncTrendyolMessages(storeId, conversationId, qid, q, customerDisplayName) {
    const questionText = String(q.text || q.question || q.questionText || "").trim();
    const questionAt = parseTrendyolDate(q.creationDate || q.createdDate || q.createdAt) || new Date();
    const fromCustomer = customerDisplayName || "Trendyol Müşteri";

    await StoreInboxMessage.findOneAndUpdate(
        { conversationId, externalId: `q_${qid}` },
        {
            $set: {
                storeId,
                direction: "in",
                text: questionText,
                sentAt: questionAt,
                fromName: fromCustomer,
            },
        },
        { upsert: true }
    );

    let lastMessageText = questionText;
    let lastMessageAt = questionAt;

    const { text: answerText, sentAt: answerAt } = extractTrendyolAnswer(q);
    if (answerText) {
        const answerWhen = answerAt || new Date();
        await StoreInboxMessage.findOneAndUpdate(
            { conversationId, externalId: `a_${qid}` },
            {
                $set: {
                    storeId,
                    direction: "out",
                    text: answerText,
                    sentAt: answerWhen,
                    fromName: "Satıcı",
                },
            },
            { upsert: true }
        );
        if (answerWhen >= questionAt) {
            lastMessageText = answerText;
            lastMessageAt = answerWhen;
        }
    } else {
        await StoreInboxMessage.deleteOne({ conversationId, externalId: `a_${qid}` });
    }

    return { lastMessageText, lastMessageAt };
}

function normalizeMediaUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (u.startsWith("//")) return `https:${u}`;
    if (/^https?:\/\//i.test(u)) return u;
    return `https://${u}`;
}

function extractTrendyolQuestionFields(q) {
    if (!q || typeof q !== "object") return null;
    const productName = String(q.productName || q.productTitle || "").trim();
    const imageUrl = normalizeMediaUrl(q.imageUrl || q.productImageUrl || q.image || q.thumbnailUrl || "");
    const webUrl = normalizeMediaUrl(q.webUrl || q.productUrl || "");
    const productMainId = q.productMainId != null && q.productMainId !== "" ? String(q.productMainId) : "";
    const barcode = q.barcode != null && q.barcode !== "" ? String(q.barcode) : "";
    const userNameRaw = q.userName ? String(q.userName).trim() : "";
    const showUserName = q.showUserName !== false;
    const customerUserName = showUserName && userNameRaw ? userNameRaw : "";
    const customerDisplayName = customerUserName || "Trendyol Müşteri";
    const customerId = q.customerId != null && q.customerId !== "" ? String(q.customerId) : "";
    const text = q.text || q.question || q.questionText || "";
    const created = parseTrendyolDate(q.creationDate || q.createdDate || q.createdAt);
    return {
        productName,
        imageUrl,
        webUrl,
        productMainId,
        barcode,
        customerUserName,
        customerDisplayName,
        customerId,
        showUserName,
        text,
        created,
        questionStatus: q.status || q.questionStatus || "",
        answeredDateMessage: q.answeredDateMessage || "",
        public: q.public,
    };
}

function buildTrendyolContext(fields, extras = {}) {
    return {
        productName: fields.productName || "",
        imageUrl: fields.imageUrl || "",
        webUrl: fields.webUrl || "",
        productMainId: fields.productMainId || "",
        barcode: fields.barcode || "",
        questionStatus: fields.questionStatus || "",
        customerUserName: fields.customerUserName || "",
        customerDisplayName: fields.customerDisplayName || "Trendyol Müşteri",
        customerId: fields.customerId || "",
        showUserName: fields.showUserName !== false,
        answeredDateMessage: fields.answeredDateMessage || "",
        public: fields.public,
        imageSource: extras.imageSource || (fields.imageUrl ? "trendyol" : ""),
    };
}

async function lookupStoreProductImage(storeId, { productMainId, productName, barcode }) {
    const StoreProduct = require("../../models/StoreProduct");
    const pick = (p) => {
        if (!p) return null;
        const img = (Array.isArray(p.images) ? p.images : []).find((x) => x && String(x).trim());
        if (!img) return null;
        return {
            imageUrl: normalizeMediaUrl(img),
            productName: p.title || "",
            barcode: p.barcode || "",
            sku: p.sku || "",
        };
    };
    if (productMainId) {
        const hit = pick(
            await StoreProduct.findOne({
                storeId,
                $or: [
                    { sku: productMainId },
                    { barcode: productMainId },
                    { "variants.sku": productMainId },
                    { "variants.barcode": productMainId },
                ],
            })
                .select("title images barcode sku")
                .lean()
        );
        if (hit) return hit;
    }
    if (barcode) {
        const hit = pick(
            await StoreProduct.findOne({
                storeId,
                $or: [{ barcode }, { "variants.barcode": barcode }],
            })
                .select("title images barcode sku")
                .lean()
        );
        if (hit) return hit;
    }
    if (productName && productName.length >= 10) {
        const escaped = productName.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const hit = pick(
            await StoreProduct.findOne({ storeId, title: new RegExp(escaped, "i") })
                .select("title images barcode sku")
                .lean()
        );
        if (hit) return hit;
    }
    return null;
}

async function enrichTrendyolFieldsFromStore(storeId, fields) {
    if (fields.imageUrl) return { ...fields, imageSource: fields.imageSource || "trendyol" };
    const local = await lookupStoreProductImage(storeId, fields);
    if (!local?.imageUrl) return fields;
    return {
        ...fields,
        imageUrl: local.imageUrl,
        productName: fields.productName || local.productName,
        barcode: fields.barcode || local.barcode || "",
        imageSource: "store_catalog",
    };
}

async function fetchTrendyolQuestionDetail(sellerId, auth, questionId) {
    const { data } = await axios.get(
        `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/${questionId}`,
        {
            headers: {
                Authorization: `Basic ${auth}`,
                "User-Agent": `${sellerId} - SelfIntegration`,
                "Content-Type": "application/json",
            },
        }
    );
    return data?.content || data?.question || data;
}

async function upsertTrendyolQuestion(storeId, userId, q, statusFilter, authCtx, options = {}) {
    const { fetchDetail = false, enrichFromStore = false } = options;
    const qid = String(q.id || q.questionId);
    if (!qid) return null;

    let fields = extractTrendyolQuestionFields(q);
    if (!fields) return null;

    if (fetchDetail && !fields.imageUrl && authCtx) {
        try {
            const detail = await fetchTrendyolQuestionDetail(authCtx.sellerId, authCtx.auth, qid);
            fields = extractTrendyolQuestionFields(detail) || fields;
        } catch (e) {
            logger.warn("[Inbox Trendyol] question detail:", parseTrendyolApiError(e));
        }
    }

    if (enrichFromStore) {
        fields = await enrichTrendyolFieldsFromStore(storeId, fields);
    }
    const context = buildTrendyolContext(fields, {
        imageSource: fields.imageSource || (fields.imageUrl ? "trendyol" : ""),
    });
    delete fields.imageSource;

    const conv = await StoreInboxConversation.findOneAndUpdate(
        { storeId, channelId: "trendyol", externalId: qid },
        {
            $set: {
                participantName: fields.customerDisplayName,
                participantUsername: "",
                participantAvatar: fields.imageUrl,
                unreadCount: (fields.questionStatus || statusFilter) === "WAITING_FOR_ANSWER" ? 1 : 0,
                context,
            },
        },
        { upsert: true, new: true }
    );

    const last = await syncTrendyolMessages(storeId, conv._id, qid, q, fields.customerDisplayName);
    await StoreInboxConversation.updateOne(
        { _id: conv._id },
        { $set: { lastMessageText: last.lastMessageText, lastMessageAt: last.lastMessageAt } }
    );
    conv.lastMessageText = last.lastMessageText;
    conv.lastMessageAt = last.lastMessageAt;

    return conv;
}

async function refreshTrendyolConversation(storeId, userId, conv) {
    if (!conv || conv.channelId !== "trendyol") return conv;

    let fields = conv.context
        ? extractTrendyolQuestionFields({
              ...conv.context,
              text: conv.lastMessageText,
              userName: conv.context.customerUserName,
              status: conv.context.questionStatus,
          })
        : null;

    if (!fields?.productName && conv.participantUsername) {
        fields = fields || extractTrendyolQuestionFields({ text: conv.lastMessageText });
        if (fields) fields.productName = conv.participantUsername;
    }

    let detailQ = null;
    if (conv.externalId) {
        const mp = await getMarketplaceForUser(userId, "trendyol");
        if (mp) {
            try {
                const creds = getDecryptedCredentials(mp);
                const authCtx = trendyolAuth(creds);
                detailQ = await fetchTrendyolQuestionDetail(authCtx.sellerId, authCtx.auth, conv.externalId);
                fields = extractTrendyolQuestionFields(detailQ) || fields;
            } catch (e) {
                logger.warn("[Inbox Trendyol] detail:", parseTrendyolApiError(e));
            }
        }
    }

    if (!fields) return conv;

    fields = await enrichTrendyolFieldsFromStore(storeId, fields);
    const context = buildTrendyolContext(fields, {
        imageSource: fields.imageSource || conv.context?.imageSource || (fields.imageUrl ? "trendyol" : ""),
    });
    if (detailQ?.answeredDateMessage) {
        context.answeredDateMessage = detailQ.answeredDateMessage;
    }

    let last = {
        lastMessageText: conv.lastMessageText,
        lastMessageAt: conv.lastMessageAt,
    };
    if (detailQ) {
        last = await syncTrendyolMessages(storeId, conv._id, conv.externalId, detailQ, fields.customerDisplayName);
    }

    const updated = await StoreInboxConversation.findOneAndUpdate(
        { _id: conv._id, storeId },
        {
            $set: {
                participantName: fields.customerDisplayName,
                participantUsername: "",
                participantAvatar: fields.imageUrl,
                context,
                lastMessageText: last.lastMessageText,
                lastMessageAt: last.lastMessageAt,
            },
        },
        { new: true }
    ).lean();

    return updated || conv;
}

function trendyolAuth(credentials) {
    const apiKey = String(credentials.apiKey || "").trim();
    const apiSecret = String(credentials.apiSecret || "").trim();
    const sellerId = String(credentials.sellerId || credentials.supplierId || "").trim();
    const supplierId = String(credentials.supplierId || credentials.sellerId || "").trim();
    if (!apiKey || !apiSecret || !sellerId) {
        throw new Error("Trendyol API bilgileri eksik (apiKey, apiSecret, sellerId/supplierId)");
    }
    if (apiKey.includes(":") && apiKey.split(":").length === 3) {
        throw new Error("Trendyol API anahtarları çözülemedi. ENCRYPTION_KEY ve entegrasyon kaydını kontrol edin.");
    }
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    return { sellerId, supplierId, auth };
}

async function syncTrendyol(storeId, userId) {
    const mp = await getMarketplaceForUser(userId, "trendyol");
    if (!mp) return { synced: 0, error: "Trendyol entegrasyonu bulunamadı" };
    const creds = getDecryptedCredentials(mp);
    let sellerId;
    let supplierId;
    let auth;
    try {
        ({ sellerId, supplierId, auth } = trendyolAuth(creds));
    } catch (e) {
        return { synced: 0, error: e.message };
    }
    let synced = 0;
    const TRENDYOL_SYNC_DAYS = 7;
    const TRENDYOL_SYNC_MAX_PAGES = 1;
    const endDate = Date.now();
    const startDate = endDate - TRENDYOL_SYNC_DAYS * 24 * 60 * 60 * 1000;
    const authCtx = { sellerId, auth };
    const upsertOpts = { fetchDetail: false, enrichFromStore: false };
    for (const status of ["WAITING_FOR_ANSWER", "ANSWERED", "WAITING_FOR_APPROVE"]) {
        try {
            let page = 0;
            let totalPages = 1;
            while (page < totalPages && page < TRENDYOL_SYNC_MAX_PAGES) {
                const { data } = await axios.get(
                    `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/filter`,
                    {
                        headers: {
                            Authorization: `Basic ${auth}`,
                            "User-Agent": `${sellerId} - SelfIntegration`,
                            "Content-Type": "application/json",
                        },
                        params: {
                            page,
                            size: 50,
                            status,
                            supplierId: Number(supplierId) || supplierId,
                            startDate,
                            endDate,
                            orderByField: "LastModifiedDate",
                            orderByDirection: "DESC",
                        },
                    }
                );
                totalPages = Math.max(1, Number(data.totalPages) || 1);
                const list = data.content || data.questions || data.data || [];
                for (const q of list) {
                    const conv = await upsertTrendyolQuestion(
                        storeId,
                        userId,
                        q,
                        status,
                        authCtx,
                        upsertOpts
                    );
                    if (conv) synced++;
                }
                page += 1;
            }
        } catch (e) {
            const msg = parseTrendyolApiError(e);
            logger.warn("[Inbox Trendyol] QnA:", msg);
            if (synced === 0 && status === "WAITING_FOR_ANSWER") {
                return { synced: 0, error: msg };
            }
        }
    }
    return { synced };
}

async function syncAmazon(storeId, userId) {
    const mp = await getMarketplaceForUser(userId, "amazon");
    if (!mp) return { synced: 0 };
    logger.info("[Inbox Amazon] SP-API mesajlaşma senkronu henüz sınırlı — bağlantı aktif.");
    return { synced: 0 };
}

async function syncMarketplaceChannel(storeId, userId, channelId) {
    if (channelId === "trendyol") return syncTrendyol(storeId, userId);
    if (channelId === "amazon") return syncAmazon(storeId, userId);
    return { synced: 0 };
}

async function sendMarketplaceMessage(storeId, userId, conversationId, text) {
    const conv = await StoreInboxConversation.findOne({ _id: conversationId, storeId });
    if (!conv) return { error: "Konuşma bulunamadı" };
    if (conv.channelId === "trendyol") {
        const mp = await getMarketplaceForUser(userId, "trendyol");
        if (!mp) return { error: "Trendyol entegrasyonu yok" };
        const creds = getDecryptedCredentials(mp);
        let sellerId;
        let auth;
        try {
            ({ sellerId, auth } = trendyolAuth(creds));
        } catch (e) {
            return { error: e.message };
        }
        try {
            await axios.post(
                `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/${conv.externalId}/answers`,
                { text },
                {
                    headers: {
                        Authorization: `Basic ${auth}`,
                        "User-Agent": `${sellerId} - SelfIntegration`,
                        "Content-Type": "application/json",
                    },
                }
            );
        } catch (e) {
            return { error: parseTrendyolApiError(e) };
        }
        try {
            const detail = await fetchTrendyolQuestionDetail(sellerId, auth, conv.externalId);
            const last = await syncTrendyolMessages(
                storeId,
                conv._id,
                conv.externalId,
                detail,
                conv.participantName
            );
            await StoreInboxConversation.updateOne(
                { _id: conv._id },
                {
                    $set: {
                        lastMessageText: last.lastMessageText,
                        lastMessageAt: last.lastMessageAt,
                        unreadCount: 0,
                        "context.questionStatus": detail?.status || "ANSWERED",
                    },
                }
            );
            const msg =
                (await StoreInboxMessage.findOne({
                    conversationId: conv._id,
                    externalId: `a_${conv.externalId}`,
                }).lean()) ||
                (await StoreInboxMessage.create({
                    storeId,
                    conversationId: conv._id,
                    externalId: `a_${conv.externalId}`,
                    direction: "out",
                    text,
                    sentAt: new Date(),
                    fromName: "Satıcı",
                }));
            return { message: msg };
        } catch (e) {
            logger.warn("[Inbox Trendyol] post-sync:", parseTrendyolApiError(e));
        }
    } else if (conv.channelId === "amazon") {
        return { error: "Amazon mesaj yanıtı yakında eklenecek. Şimdilik Amazon Seller Central kullanın." };
    }
    const msg = await StoreInboxMessage.create({
        storeId,
        conversationId: conv._id,
        externalId: `out_${Date.now()}`,
        direction: "out",
        text,
        sentAt: new Date(),
        fromName: "Satıcı",
    });
    await StoreInboxConversation.updateOne(
        { _id: conv._id },
        { $set: { lastMessageText: text, lastMessageAt: new Date(), unreadCount: 0 } }
    );
    return { message: msg };
}

module.exports = {
    MARKETPLACE_CHANNELS,
    connectMarketplaceChannel,
    syncMarketplaceChannel,
    sendMarketplaceMessage,
    refreshTrendyolConversation,
    getMarketplaceForUser,
    getDecryptedCredentials,
};
