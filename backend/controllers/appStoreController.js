const mongoose = require("mongoose");
const appStoreService = require("../services/appStoreService");
const { getEffectivePlan } = require("../services/planFeatureService");
const logger = require("../config/logger");

function userId(req) {
    try {
        return new mongoose.Types.ObjectId(String(req.user?._id || req.user?.id));
    } catch {
        return null;
    }
}

exports.getCatalog = async (req, res) => {
    try {
        const uid = userId(req);
        if (!uid) return res.status(401).json({ error: "Yetkisiz" });
        const plan = getEffectivePlan(req.user);
        const data = await appStoreService.listCatalog(uid, plan, {
            categoryId: req.query.category,
            search: req.query.search,
        });
        return res.json({ success: true, ...data });
    } catch (e) {
        logger.error("[AppStore] catalog:", e.message);
        return res.status(500).json({ error: e.message });
    }
};

exports.getInstalled = async (req, res) => {
    try {
        const uid = userId(req);
        if (!uid) return res.status(401).json({ error: "Yetkisiz" });
        const plan = getEffectivePlan(req.user);
        const apps = await appStoreService.listInstalled(uid, plan);
        return res.json({ success: true, apps });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.install = async (req, res) => {
    try {
        const uid = userId(req);
        const { appKey } = req.body || {};
        if (!appKey) return res.status(400).json({ error: "appKey gerekli" });
        const plan = getEffectivePlan(req.user);
        const out = await appStoreService.installApp(uid, plan, appKey);
        if (out.error) {
            return res.status(out.upgrade ? 403 : 400).json({ error: out.error, upgrade: out.upgrade });
        }
        return res.status(201).json({ success: true, app: out.app, installation: out.installation });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.uninstall = async (req, res) => {
    try {
        const uid = userId(req);
        const out = await appStoreService.uninstallApp(uid, req.params.appKey);
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
