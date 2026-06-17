const multer = require("multer");
const storeSellerVerificationService = require("../services/storeSellerVerificationService");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
});

exports.uploadMiddleware = upload.single("file");

exports.getVerification = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const data = await storeSellerVerificationService.getVerification(userId);
        if (data.error) return res.status(data.code || 400).json({ error: data.error });
        return res.json({ success: true, ...data });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.saveVerification = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const data = await storeSellerVerificationService.saveVerification(userId, req.body || {});
        if (data.error) return res.status(data.code || 400).json({ error: data.error });
        return res.json({ success: true, ...data });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.uploadDocument = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { docType } = req.params;
        if (!req.file) return res.status(400).json({ error: "Dosya gerekli" });
        const data = await storeSellerVerificationService.attachDocument(userId, docType, req.file);
        if (data.error) return res.status(data.code || 400).json({ error: data.error });
        return res.json({ success: true, ...data });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteDocument = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { docType } = req.params;
        const data = await storeSellerVerificationService.removeDocument(userId, docType);
        if (data.error) return res.status(data.code || 400).json({ error: data.error });
        return res.json({ success: true, ...data });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
