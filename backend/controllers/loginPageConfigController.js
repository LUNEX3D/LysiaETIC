const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const loginPageConfigService = require("../services/loginPageConfigService");
const logger = require("../config/logger");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "login-partners");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
        cb(null, `partner-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = /image\/(jpeg|jpg|png|webp|svg\+xml|svg)/i.test(file.mimetype);
        cb(ok ? null : new Error("Yalnızca görsel dosyaları (PNG, JPG, WEBP, SVG) yüklenebilir."), ok);
    },
});

exports.getPublicConfig = async (_req, res) => {
    try {
        const data = await loginPageConfigService.getPublicLoginPageConfig();
        res.json({ success: true, data });
    } catch (error) {
        logger.error("[LoginPage] public config hatası: " + error.message);
        res.status(500).json({ success: false, message: "Giriş sayfası içeriği alınamadı" });
    }
};

exports.getAdminConfig = async (_req, res) => {
    try {
        const data = await loginPageConfigService.getAdminLoginPageConfig();
        res.json({ success: true, data });
    } catch (error) {
        logger.error("[LoginPage] admin get hatası: " + error.message);
        res.status(500).json({ success: false, message: "Ayarlar alınamadı" });
    }
};

exports.updateConfig = async (req, res) => {
    try {
        const payload = req.body?.data || req.body || {};
        const data = await loginPageConfigService.updateLoginPageConfig(payload, req.user?._id);
        res.json({ success: true, message: "Giriş sayfası güncellendi", data });
    } catch (error) {
        logger.error("[LoginPage] update hatası: " + error.message);
        res.status(500).json({ success: false, message: error.message || "Güncelleme başarısız" });
    }
};

exports.addPartner = async (req, res) => {
    try {
        const name = String(req.body?.name || "").trim();
        if (!name) {
            return res.status(400).json({ success: false, message: "Firma adı zorunludur" });
        }

        const doc = await loginPageConfigService.getOrCreateConfig();
        const logoUrl = req.file
            ? `/uploads/login-partners/${req.file.filename}`
            : String(req.body?.logoUrl || "").trim();
        const order = Number(req.body?.order) || (doc.partners?.items?.length || 0);
        doc.partners.items.push({
            name,
            logoUrl,
            website: String(req.body?.website || "").trim(),
            order,
            active: req.body?.active !== "false" && req.body?.active !== false,
        });
        doc.updatedBy = req.user?._id;
        await doc.save();

        const data = await loginPageConfigService.getAdminLoginPageConfig();
        res.status(201).json({ success: true, message: "Referans firma eklendi", data });
    } catch (error) {
        logger.error("[LoginPage] partner add hatası: " + error.message);
        res.status(500).json({ success: false, message: error.message || "Firma eklenemedi" });
    }
};

exports.updatePartner = async (req, res) => {
    try {
        const { partnerId } = req.params;
        const doc = await loginPageConfigService.getOrCreateConfig();
        const item = doc.partners.items.id(partnerId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Firma bulunamadı" });
        }

        if (req.body?.name) item.name = String(req.body.name).trim();
        if (req.body?.website !== undefined) item.website = String(req.body.website || "").trim();
        if (req.body?.order !== undefined) item.order = Number(req.body.order) || 0;
        if (req.body?.active !== undefined) {
            item.active = req.body.active === true || req.body.active === "true";
        }
        if (req.file) {
            const old = item.logoUrl;
            item.logoUrl = `/uploads/login-partners/${req.file.filename}`;
            if (old && old.startsWith("/uploads/login-partners/")) {
                const oldPath = path.join(__dirname, "..", old.replace(/^\//, ""));
                fs.unlink(oldPath, () => {});
            }
        }

        doc.updatedBy = req.user?._id;
        await doc.save();
        const data = await loginPageConfigService.getAdminLoginPageConfig();
        res.json({ success: true, message: "Firma güncellendi", data });
    } catch (error) {
        logger.error("[LoginPage] partner update hatası: " + error.message);
        res.status(500).json({ success: false, message: error.message || "Güncelleme başarısız" });
    }
};

exports.deletePartner = async (req, res) => {
    try {
        const { partnerId } = req.params;
        const doc = await loginPageConfigService.getOrCreateConfig();
        const item = doc.partners.items.id(partnerId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Firma bulunamadı" });
        }
        const logoUrl = item.logoUrl;
        doc.partners.items.pull(partnerId);
        doc.updatedBy = req.user?._id;
        await doc.save();

        if (logoUrl && logoUrl.startsWith("/uploads/login-partners/")) {
            const filePath = path.join(__dirname, "..", logoUrl.replace(/^\//, ""));
            fs.unlink(filePath, () => {});
        }

        const data = await loginPageConfigService.getAdminLoginPageConfig();
        res.json({ success: true, message: "Firma kaldırıldı", data });
    } catch (error) {
        logger.error("[LoginPage] partner delete hatası: " + error.message);
        res.status(500).json({ success: false, message: error.message || "Silme başarısız" });
    }
};

exports.partnerUpload = upload.single("logo");

exports.seedPartnerTemplate = async (req, res) => {
    try {
        const replace = req.body?.replace === true || req.body?.replace === "true";
        const data = await loginPageConfigService.seedPartnerTemplate(req.user?._id, { replace });
        res.json({ success: true, message: "Hazır şablon yüklendi", data });
    } catch (error) {
        const status = error.statusCode || 500;
        logger.error("[LoginPage] seed template hatası: " + error.message);
        res.status(status).json({ success: false, message: error.message || "Şablon yüklenemedi" });
    }
};
