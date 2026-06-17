const StoreInboxSettings = require("../models/StoreInboxSettings");
const metaInbox = require("./inbox/metaInboxService");
const googleInbox = require("./inbox/googleInboxService");
const marketplaceInbox = require("./inbox/marketplaceInboxService");
const internalInbox = require("./inbox/internalInboxService");
const emailInbox = require("./inbox/emailInboxService");

const CHANNEL_IDS = StoreInboxSettings.CHANNEL_IDS;

function defaultChannels() {
    return CHANNEL_IDS.map((channelId) => ({
        channelId,
        connected: false,
        accountLabel: "",
        connectedAt: null,
        pageId: "",
        igUserId: "",
        externalRef: "",
        marketplaceId: "",
    }));
}

function sanitizeChannel(c) {
    return {
        channelId: c.channelId,
        connected: !!c.connected,
        accountLabel: c.accountLabel || "",
        connectedAt: c.connectedAt || null,
        pageId: c.pageId || "",
        igUserId: c.igUserId || "",
        externalRef: c.externalRef || "",
        marketplaceId: c.marketplaceId || "",
    };
}

function normalizeSettings(doc) {
    const channels = CHANNEL_IDS.map((channelId) => {
        const found = (doc.channels || []).find((c) => c.channelId === channelId);
        return found ? sanitizeChannel({ channelId, ...found }) : sanitizeChannel({ channelId });
    });
    const canned =
        doc.cannedResponses?.length > 0
            ? doc.cannedResponses.map((r, i) => ({
                  id: r.id || `c${i}`,
                  text: r.text || "",
                  order: typeof r.order === "number" ? r.order : i,
              }))
            : StoreInboxSettings.DEFAULT_CANNED;
    return {
        _id: doc._id,
        onboardingStep: doc.onboardingStep || "welcome",
        channels,
        cannedResponses: [...canned].sort((a, b) => a.order - b.order),
        instagramOAuthAvailable: metaInbox.isMetaConfigured(),
        instagramDemoMode: metaInbox.isDemoMode(),
        metaOAuthAvailable: metaInbox.isMetaConfigured(),
        metaDemoMode: metaInbox.isDemoMode(),
        googleInboxOAuthAvailable: googleInbox.isGoogleInboxConfigured(),
        updatedAt: doc.updatedAt,
        createdAt: doc.createdAt,
    };
}

async function getOrCreateSettings(storeId, userId) {
    let doc = await StoreInboxSettings.findOne({ storeId }).lean();
    if (!doc) {
        doc = (
            await StoreInboxSettings.create({
                storeId,
                userId,
                onboardingStep: "welcome",
                channels: defaultChannels(),
                cannedResponses: StoreInboxSettings.DEFAULT_CANNED,
            })
        ).toObject();
    } else if (!doc.channels?.length) {
        doc = (
            await StoreInboxSettings.findOneAndUpdate(
                { storeId },
                { $set: { channels: defaultChannels() } },
                { new: true }
            )
        ).toObject();
    }
    return normalizeSettings(doc);
}

async function updateSettings(storeId, patch) {
    const update = {};
    if (patch.onboardingStep && ["welcome", "channels", "done"].includes(patch.onboardingStep)) {
        update.onboardingStep = patch.onboardingStep;
    }
    if (Array.isArray(patch.cannedResponses)) {
        update.cannedResponses = patch.cannedResponses
            .map((r, i) => ({
                id: String(r.id || `c${i}_${Date.now()}`),
                text: String(r.text || "").trim().slice(0, 2000),
                order: typeof r.order === "number" ? r.order : i,
            }))
            .filter((r) => r.text.length > 0);
    }
    if (!Object.keys(update).length) return { error: "Güncellenecek alan yok" };
    const doc = await StoreInboxSettings.findOneAndUpdate({ storeId }, { $set: update }, { new: true }).lean();
    if (!doc) return { error: "Gelen kutusu ayarları bulunamadı" };
    return { settings: normalizeSettings(doc) };
}

async function connectChannel(storeId, userId, channelId, body = {}) {
    if (!CHANNEL_IDS.includes(channelId)) return { error: "Geçersiz kanal" };

    if (metaInbox.META_CHANNEL_IDS.includes(channelId)) {
        const out = await metaInbox.connectMetaChannel(storeId, userId, channelId);
        if (out.error) return { error: out.error };
        if (out.oauthUrl) {
            return { oauthUrl: out.oauthUrl, settings: await getOrCreateSettings(storeId, userId) };
        }
        return { settings: out.settings };
    }

    if (marketplaceInbox.MARKETPLACE_CHANNELS[channelId]) {
        const out = await marketplaceInbox.connectMarketplaceChannel(storeId, userId, channelId);
        if (out.error) return { error: out.error };
        return { settings: out.settings, synced: out.synced, syncError: out.syncError };
    }

    if (channelId === "email") {
        const out = await emailInbox.connectEmailChannel(storeId, userId, body);
        if (out.error) return { error: out.error };
        return {
            settings: out.settings,
            synced: out.synced,
            syncError: out.syncError,
            syncHint: out.syncHint,
            connectionMode: out.connectionMode,
        };
    }

    if (internalInbox.INTERNAL_CHANNELS.includes(channelId)) {
        const out = await internalInbox.connectInternalChannel(storeId, userId, channelId, body);
        if (out.error) return { error: out.error };
        return { settings: out.settings };
    }

    return { error: "Desteklenmeyen kanal" };
}

async function disconnectChannel(storeId, channelId) {
    if (!CHANNEL_IDS.includes(channelId)) return { error: "Geçersiz kanal" };
    const docWithTokens = await StoreInboxSettings.findOne({ storeId }).select("+channels.accessToken");
    if (!docWithTokens) return { error: "Gelen kutusu ayarları bulunamadı" };
    const channels = (docWithTokens.channels || []).map((c) => {
        if (c.channelId !== channelId) return c;
        return {
            channelId,
            connected: false,
            accountLabel: "",
            connectedAt: null,
            pageId: "",
            igUserId: "",
            externalRef: "",
            marketplaceId: "",
            accessToken: "",
            tokenExpiresAt: null,
        };
    });
    docWithTokens.channels = channels;
    await docWithTokens.save();
    return { settings: normalizeSettings(docWithTokens.toObject()) };
}

module.exports = {
    CHANNEL_IDS,
    normalizeSettings,
    getOrCreateSettings,
    updateSettings,
    connectChannel,
    disconnectChannel,
};
