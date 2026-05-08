const ClientErrorLog = require("../models/ClientErrorLog");
const logger = require("../config/logger");

const normalizeItem = (item = {}) => ({
    source: String(item.source || "api").slice(0, 40),
    statusCode: Number(item.statusCode || 0) || 0,
    path: String(item.path || "").slice(0, 300),
    method: String(item.method || "GET").toUpperCase().slice(0, 10),
    message: String(item.message || "Bilinmeyen istemci hatası").slice(0, 500),
    stack: String(item.stack || "").slice(0, 4000),
    userAgent: String(item.userAgent || "").slice(0, 500),
    pageUrl: String(item.pageUrl || "").slice(0, 500),
    meta: typeof item.meta === "object" && item.meta !== null ? item.meta : {},
});

exports.createClientError = async (req, res) => {
    try {
        const payload = normalizeItem(req.body || {});
        const doc = await ClientErrorLog.create({
            userId: req.user._id,
            ...payload
        });

        logger.warn(`[ClientError] ${req.user.email} ${payload.method} ${payload.path} ${payload.statusCode} ${payload.message}`);
        return res.json({ success: true, id: doc._id });
    } catch (error) {
        logger.error(`Client error log kayıt hatası: ${error.message}`);
        return res.status(500).json({ success: false, message: "İstemci hata kaydı alınamadı" });
    }
};

exports.createClientErrorsBulk = async (req, res) => {
    try {
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        if (!items.length) {
            return res.status(400).json({ success: false, message: "items zorunludur" });
        }

        const normalized = items.slice(0, 50).map((it) => ({
            userId: req.user._id,
            ...normalizeItem(it),
        }));
        await ClientErrorLog.insertMany(normalized, { ordered: false });
        return res.json({ success: true, inserted: normalized.length });
    } catch (error) {
        logger.error(`Client error bulk kayıt hatası: ${error.message}`);
        return res.status(500).json({ success: false, message: "Toplu istemci hata kaydı alınamadı" });
    }
};

/** Oturum açmış kullanıcının sunucuya daha önce gönderdiği istemci hata kayıtları */
exports.getClientErrorsMine = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 80), 200);
        const rows = await ClientErrorLog.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        return res.json({ success: true, errors: rows });
    } catch (error) {
        logger.error(`Kullanıcı istemci hata listesi: ${error.message}`);
        return res.status(500).json({ success: false, message: "Kayıtlar alınamadı" });
    }
};

exports.getClientErrorsAdmin = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 100), 500);
        const filter = {};
        if (req.query.statusCode) filter.statusCode = Number(req.query.statusCode);
        if (req.query.source) filter.source = String(req.query.source);
        if (req.query.userId) filter.userId = req.query.userId;
        if (req.query.from || req.query.to) {
            filter.createdAt = {};
            if (req.query.from) {
                const from = new Date(req.query.from);
                if (!Number.isNaN(from.getTime())) filter.createdAt.$gte = from;
            }
            if (req.query.to) {
                const to = new Date(req.query.to);
                if (!Number.isNaN(to.getTime())) filter.createdAt.$lte = to;
            }
            if (!Object.keys(filter.createdAt).length) delete filter.createdAt;
        }

        const rows = await ClientErrorLog.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate("userId", "email name role")
            .lean();
        return res.json({ success: true, errors: rows });
    } catch (error) {
        logger.error(`Admin client error listeleme hatası: ${error.message}`);
        return res.status(500).json({ success: false, message: "İstemci hata kayıtları alınamadı" });
    }
};
