const storeService = require("../services/storeService");
const storeInboxService = require("../services/storeInboxService");
const metaInboxService = require("../services/inbox/metaInboxService");
const googleInboxService = require("../services/inbox/googleInboxService");
const inboxSyncService = require("../services/inbox/inboxSyncService");
const internalInboxService = require("../services/inbox/internalInboxService");
const logger = require("../config/logger");

function toUserId(req) {
    return req.user?.id || req.user?._id;
}

exports.getInboxSettings = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const settings = await storeInboxService.getOrCreateSettings(store._id, userId);
        return res.json({ success: true, settings });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.patchInboxSettings = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        await storeInboxService.getOrCreateSettings(store._id, userId);
        const out = await storeInboxService.updateSettings(store._id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, settings: out.settings });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.connectInboxChannel = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeInboxService.connectChannel(store._id, userId, req.params.channelId, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({
            success: true,
            settings: out.settings,
            oauthUrl: out.oauthUrl || null,
            synced: out.synced ?? null,
            syncError: out.syncError || null,
            syncHint: out.syncHint || null,
            connectionMode: out.connectionMode || null,
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.disconnectInboxChannel = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeInboxService.disconnectChannel(store._id, req.params.channelId);
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, settings: out.settings });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.instagramOAuthStart = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const channel = req.query.channel || "instagram";
        const oauth = metaInboxService.buildOAuthUrl(store._id, userId, channel);
        if (oauth.error) return res.status(400).json({ error: oauth.error });
        return res.json({ success: true, url: oauth.url });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.instagramOAuthCallback = async (req, res) => {
    const redirect = (query) => res.redirect(metaInboxService.getDashboardRedirectUrl(query));
    try {
        const { code, state, error, error_description: errorDesc } = req.query;
        if (error) {
            return redirect({
                panel: "ec-inbox-settings",
                inbox_oauth: "error",
                inbox_oauth_kind: "meta",
                inbox_error: errorDesc || error,
            });
        }
        if (!code || !state) {
            return redirect({
                panel: "ec-inbox-settings",
                inbox_oauth: "error",
                inbox_oauth_kind: "meta",
                inbox_error: "Eksik OAuth parametreleri",
            });
        }
        const result = await metaInboxService.handleOAuthCallback(code, state);
        if (result.error) {
            return redirect({
                panel: "ec-inbox-settings",
                inbox_oauth: "error",
                inbox_oauth_kind: "meta",
                inbox_error: result.error,
            });
        }
        return redirect({
            panel: "ec-inbox-settings",
            inbox_oauth: "success",
            inbox_oauth_kind: "meta",
        });
    } catch (e) {
        logger.error("[Inbox IG OAuth]", e.message);
        return redirect({
            panel: "ec-inbox-settings",
            inbox_oauth: "error",
            inbox_oauth_kind: "meta",
            inbox_error: e.message,
        });
    }
};

exports.googleInboxOAuthStart = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const oauth = googleInboxService.buildOAuthUrl(store._id, userId);
        if (oauth.error) return res.status(400).json({ error: oauth.error });
        return res.json({ success: true, url: oauth.url });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.googleInboxOAuthCallback = async (req, res) => {
    const redirect = (query) => res.redirect(googleInboxService.getDashboardRedirectUrl(query));
    try {
        const { code, state, error, error_description: errorDesc } = req.query;
        if (error) {
            return redirect({
                panel: "ec-inbox-settings",
                inbox_oauth: "error",
                inbox_oauth_kind: "google",
                inbox_error: errorDesc || error,
            });
        }
        if (!code || !state) {
            return redirect({
                panel: "ec-inbox-settings",
                inbox_oauth: "error",
                inbox_oauth_kind: "google",
                inbox_error: "Eksik OAuth parametreleri",
            });
        }
        const result = await googleInboxService.handleOAuthCallback(code, state);
        if (result.error) {
            return redirect({
                panel: "ec-inbox-settings",
                inbox_oauth: "error",
                inbox_oauth_kind: "google",
                inbox_error: result.error,
            });
        }
        return redirect({
            panel: "ec-inbox-settings",
            inbox_oauth: "success",
            inbox_oauth_kind: "google",
        });
    } catch (e) {
        logger.error("[Inbox Gmail OAuth]", e.message);
        return redirect({
            panel: "ec-inbox-settings",
            inbox_oauth: "error",
            inbox_oauth_kind: "google",
            inbox_error: e.message,
        });
    }
};

exports.listInboxConversations = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const conversations = await inboxSyncService.listConversations(store._id, userId);
        return res.json({ success: true, conversations });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getInboxMessages = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await inboxSyncService.listMessages(store._id, userId, req.params.conversationId);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, conversation: out.conversation, messages: out.messages });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.sendInboxMessage = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await inboxSyncService.sendMessage(store._id, userId, req.params.conversationId, req.body?.text);
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, message: out.message });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.syncInbox = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const result = await inboxSyncService.syncStoreInbox(store._id, userId);
        const conversations = await inboxSyncService.listConversations(store._id, userId, { sync: false });
        return res.json({ success: true, synced: result.synced, conversations });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
