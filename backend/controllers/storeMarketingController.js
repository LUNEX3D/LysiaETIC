const storeService = require("../services/storeService");
const dashboard = require("../services/marketing/marketingDashboardService");
const campaigns = require("../services/marketing/marketingCampaignService");
const automations = require("../services/marketing/marketingAutomationService");
const segments = require("../services/marketing/marketingSegmentService");
const popups = require("../services/marketing/marketingPopupService");
const affiliates = require("../services/marketing/marketingAffiliateService");
const settings = require("../services/marketing/marketingSettingsService");

function toUserId(req) {
    return req.user?.id || req.user?._id;
}

async function requireStore(req) {
    const userId = toUserId(req);
    const store = await storeService.getStoreByUserId(userId);
    if (!store) return { error: "Mağaza yok", status: 404 };
    return { store, userId };
}

exports.getDashboard = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const data = await dashboard.getDashboard(ctx.store._id, req.query.range || "7d");
        return res.json({ success: true, ...data });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getReports = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const data = await dashboard.getReports(ctx.store._id, req.query.range || "30d");
        return res.json({ success: true, ...data });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listCampaigns = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const items = await campaigns.listCampaigns(ctx.store._id, req.query);
        return res.json({ success: true, campaigns: items });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createCampaign = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const item = await campaigns.createCampaign(ctx.store._id, ctx.userId, req.body || {});
        return res.json({ success: true, campaign: item });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getCampaign = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const item = await campaigns.getCampaign(ctx.store._id, req.params.id);
        if (!item) return res.status(404).json({ error: "Kampanya bulunamadı" });
        return res.json({ success: true, campaign: item });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateCampaign = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const item = await campaigns.updateCampaign(ctx.store._id, req.params.id, req.body || {});
        if (!item) return res.status(404).json({ error: "Kampanya bulunamadı" });
        return res.json({ success: true, campaign: item });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteCampaign = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        await campaigns.deleteCampaign(ctx.store._id, req.params.id);
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.sendCampaign = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const out = await campaigns.sendCampaign(ctx.store._id, req.params.id);
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, ...out });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getTemplates = async (req, res) => {
    return res.json({ success: true, templates: campaigns.TEMPLATES });
};

exports.listAutomations = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const items = await automations.listAutomations(ctx.store._id);
        return res.json({ success: true, automations: items });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createAutomation = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const item = await automations.createAutomation(ctx.store._id, ctx.userId, req.body || {});
        return res.json({ success: true, automation: item });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getAutomation = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const item = await automations.getAutomation(ctx.store._id, req.params.id);
        if (!item) return res.status(404).json({ error: "Otomasyon bulunamadı" });
        return res.json({ success: true, automation: item });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateAutomation = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const item = await automations.updateAutomation(ctx.store._id, req.params.id, req.body || {});
        if (!item) return res.status(404).json({ error: "Otomasyon bulunamadı" });
        return res.json({ success: true, automation: item });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteAutomation = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        await automations.deleteAutomation(ctx.store._id, req.params.id);
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listSegments = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const items = await segments.listSegments(ctx.store._id);
        return res.json({ success: true, segments: items });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createSegment = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const item = await segments.createSegment(ctx.store._id, ctx.userId, req.body || {});
        return res.json({ success: true, segment: item });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateSegment = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const item = await segments.updateSegment(ctx.store._id, req.params.id, req.body || {});
        if (!item) return res.status(404).json({ error: "Segment bulunamadı" });
        return res.json({ success: true, segment: item });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteSegment = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        await segments.deleteSegment(ctx.store._id, req.params.id);
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.previewSegment = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const rules = req.body?.rules || req.query.rules;
        const parsed = typeof rules === "string" ? JSON.parse(rules) : rules;
        const data = await segments.previewSegment(ctx.store._id, parsed);
        return res.json({ success: true, ...data });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.refreshSegment = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const item = await segments.refreshSegmentCount(ctx.store._id, req.params.id);
        if (!item) return res.status(404).json({ error: "Segment bulunamadı" });
        return res.json({ success: true, segment: item });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listPopups = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const items = await popups.listPopups(ctx.store._id);
        return res.json({ success: true, popups: items });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createPopup = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const item = await popups.createPopup(ctx.store._id, ctx.userId, req.body || {});
        return res.json({ success: true, popup: item });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updatePopup = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const item = await popups.updatePopup(ctx.store._id, req.params.id, req.body || {});
        if (!item) return res.status(404).json({ error: "Popup bulunamadı" });
        return res.json({ success: true, popup: item });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deletePopup = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        await popups.deletePopup(ctx.store._id, req.params.id);
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listAffiliates = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const items = await affiliates.listAffiliates(ctx.store._id);
        return res.json({ success: true, affiliates: items });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createAffiliate = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const item = await affiliates.createAffiliate(ctx.store._id, ctx.userId, req.body || {});
        return res.json({ success: true, affiliate: item });
    } catch (e) {
        return res.status(400).json({ error: e.message });
    }
};

exports.updateAffiliate = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const item = await affiliates.updateAffiliate(ctx.store._id, req.params.id, req.body || {});
        if (!item) return res.status(404).json({ error: "Affiliate bulunamadı" });
        return res.json({ success: true, affiliate: item });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteAffiliate = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        await affiliates.deleteAffiliate(ctx.store._id, req.params.id);
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getSettings = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const doc = await settings.getOrCreateSettings(ctx.store._id);
        return res.json({ success: true, settings: settings.sanitizeForClient(doc) });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const ctx = await requireStore(req);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const doc = await settings.updateSettings(ctx.store._id, req.body || {});
        return res.json({ success: true, settings: settings.sanitizeForClient(doc) });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
