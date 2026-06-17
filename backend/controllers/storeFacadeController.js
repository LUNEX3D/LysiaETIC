"use strict";

const storeFacadeService = require("../services/storeFacadeService");
const aiStoreGenerationService = require("../services/aiStoreGenerationService");
const logger = require("../config/logger");

function toUserId(req) {
    const id = req.user?._id || req.user?.id;
    return id ? String(id) : null;
}

exports.getCatalog = async (_req, res) => {
    try {
        return res.json({ success: true, ...storeFacadeService.getCatalogMeta() });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listStores = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        await storeFacadeService.backfillLinks(userId);
        const stores = await storeFacadeService.listStoresForUser(userId);
        return res.json({ success: true, stores });
    } catch (e) {
        logger.error("[StoreFacade] list:", e.message);
        return res.status(500).json({ error: e.message });
    }
};

exports.createStore = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        const { name, slug, businessType, brandStyle, useAi } = req.body || {};
        if (!name?.trim()) return res.status(400).json({ error: "Mağaza adı gerekli" });

        const out = useAi
            ? await aiStoreGenerationService.generateStore(userId, req.body)
            : await storeFacadeService.createLinkedStore(userId, {
                  name,
                  slug,
                  businessType,
                  brandStyle,
              });

        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, ...out });
    } catch (e) {
        logger.error("[StoreFacade] create:", e.message);
        return res.status(500).json({ error: e.message });
    }
};

exports.getSetupProgress = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        const siteId = req.params.siteId || req.query.siteId;
        const out = await storeFacadeService.getSetupProgress(userId, siteId);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, progress: out });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.applyKit = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        const { siteId } = req.params;
        const out = await storeFacadeService.applyStarterKit(userId, siteId, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, ...out });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.publish = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        const { siteId } = req.params;
        const out = await storeFacadeService.publishStorefront(userId, siteId);
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, ...out });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.generateAi = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        const out = await aiStoreGenerationService.generateStore(userId, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, ...out });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
